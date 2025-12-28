#include <Arduino.h>
#include "config/config.h"
#include "modem/ModemManager.h"
#include "ppp/PppManager.h"
#include "mqtt/MqttManager.h"
#include "protocol/Protocol.h"
#include "util/Backoff.h"

// System state machine
enum SystemState {
    STATE_MODEM_INIT,
    STATE_PPP_CONNECTING,
    STATE_PPP_UP,
    STATE_MQTT_CONNECTING,
    STATE_MQTT_CONNECTED,
    STATE_DEGRADED
};

// Global managers
ModemManager modemManager;
PppManager pppManager(&modemManager);
MqttManager mqttManager;
Backoff degradedBackoff(BACKOFF_BASE_MS, BACKOFF_MAX_MS);

// State machine
SystemState currentState = STATE_MODEM_INIT;
unsigned long stateEntryTime = 0;
unsigned long lastStatusPublish = 0;

// Command handling
char ackBuffer[256];
char statusBuffer[256];

// Forward declarations
void transitionTo(SystemState newState, unsigned long now);
void handleCommand(const char* topic, const char* payload);
void publishStatus(unsigned long now);

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("========================================");
    Serial.println("Parking Gate Remote - MCU Firmware");
    Serial.print("Device ID: ");
    Serial.println(DEVICE_ID);
    Serial.print("FW Version: ");
    Serial.println(FW_VERSION);
    Serial.println("========================================");

    // Initialize MQTT manager
    mqttManager.begin();

    // Set command callback
    mqttManager.setCommandCallback(handleCommand);

    stateEntryTime = millis();
    Serial.println("[Main] Starting in STATE_MODEM_INIT state");
}

void loop() {
    unsigned long now = millis();

    // Process MQTT messages if connected
    if (currentState == STATE_MQTT_CONNECTED) {
        mqttManager.loop();
    }

    // State machine
    switch (currentState) {
        case STATE_MODEM_INIT:
            handleModemInit(now);
            break;

        case STATE_PPP_CONNECTING:
            handlePppConnecting(now);
            break;

        case STATE_PPP_UP:
            handlePppUp(now);
            break;

        case STATE_MQTT_CONNECTING:
            handleMqttConnecting(now);
            break;

        case STATE_MQTT_CONNECTED:
            handleMqttConnected(now);
            break;

        case STATE_DEGRADED:
            handleDegraded(now);
            break;
    }

    // Feed watchdog if enabled
    // (ESP32 doesn't have hardware watchdog by default, but can be enabled)
}

void handleModemInit(unsigned long now) {
    if (modemManager.init()) {
        transitionTo(STATE_PPP_CONNECTING, now);
    } else if (now - stateEntryTime > AT_INIT_TIMEOUT_MS) {
        Serial.println("[Main] Modem init timeout, retrying...");
        modemManager.powerCycle();
        stateEntryTime = now;
    }
}

void handlePppConnecting(unsigned long now) {
    // Check if we need to start PPP
    static bool pppStarted = false;
    if (!pppStarted) {
        if (pppManager.start()) {
            pppStarted = true;
        } else {
            // Check if hard reset is needed
            if (pppManager.shouldHardReset()) {
                Serial.println("[Main] PPP failure threshold exceeded, hard resetting modem");
                pppManager.stop();
                modemManager.hardReset();
                pppManager.resetPppFailStreak();
                transitionTo(STATE_MODEM_INIT, now);
                pppStarted = false;
                return;
            }
        }
    }

    // Wait for PPP to come up
    if (pppManager.waitForPppUp(PPP_TIMEOUT_MS)) {
        transitionTo(STATE_PPP_UP, now);
        pppStarted = false;
    } else if (now - stateEntryTime > PPP_TIMEOUT_MS) {
        Serial.println("[Main] PPP connection timeout");
        pppManager.incrementFailStreak();

        if (pppManager.shouldHardReset()) {
            Serial.println("[Main] PPP failure threshold exceeded, hard resetting modem");
            pppManager.stop();
            modemManager.hardReset();
            pppManager.resetPppFailStreak();
            transitionTo(STATE_MODEM_INIT, now);
        } else {
            // Retry PPP
            pppManager.stop();
            pppStarted = false;
            stateEntryTime = now;
        }
    }
}

void handlePppUp(unsigned long now) {
    // Transition immediately to MQTT_CONNECTING
    transitionTo(STATE_MQTT_CONNECTING, now);
}

void handleMqttConnecting(unsigned long now) {
    if (mqttManager.connect()) {
        transitionTo(STATE_MQTT_CONNECTED, now);
    } else {
        // Check if we need to rebuild PPP
        if (mqttManager.shouldRebuildPpp()) {
            Serial.println("[Main] MQTT failure threshold exceeded, rebuilding PPP");
            mqttManager.disconnect();
            pppManager.stop();
            mqttManager.resetMqttFailStreak();
            transitionTo(STATE_PPP_CONNECTING, now);
        } else if (now - stateEntryTime > 30000) {
            // Timeout after 30 seconds, retry
            Serial.println("[Main] MQTT connection timeout, retrying...");
            stateEntryTime = now;
        }
    }
}

void handleMqttConnected(unsigned long now) {
    // Check connection health
    if (!mqttManager.isConnected()) {
        Serial.println("[Main] MQTT connection lost");
        mqttManager.incrementFailStreak();

        if (mqttManager.shouldRebuildPpp()) {
            Serial.println("[Main] MQTT failure threshold exceeded, rebuilding PPP");
            mqttManager.disconnect();
            pppManager.stop();
            mqttManager.resetMqttFailStreak();
            transitionTo(STATE_PPP_CONNECTING, now);
        } else {
            transitionTo(STATE_MQTT_CONNECTING, now);
        }
        return;
    }

    // Publish status heartbeat
    if (now - lastStatusPublish >= STATUS_INTERVAL_MS) {
        publishStatus(now);
        lastStatusPublish = now;
    }

    // Check PPP health
    if (!pppManager.isUp()) {
        Serial.println("[Main] PPP connection lost");
        pppManager.incrementFailStreak();

        if (pppManager.shouldHardReset()) {
            Serial.println("[Main] PPP failure threshold exceeded, hard resetting modem");
            mqttManager.disconnect();
            pppManager.stop();
            modemManager.hardReset();
            pppManager.resetPppFailStreak();
            transitionTo(STATE_MODEM_INIT, now);
        } else {
            mqttManager.disconnect();
            transitionTo(STATE_PPP_CONNECTING, now);
        }
    }
}

void handleDegraded(unsigned long now) {
    // Apply backoff
    static unsigned long lastRetryAttempt = 0;

    if (lastRetryAttempt == 0 || (now - lastRetryAttempt) >= degradedBackoff.getNextDelay()) {
        lastRetryAttempt = now;
        Serial.println("[Main] Retrying connection from degraded state");

        // Try to reconnect
        if (pppManager.isUp()) {
            transitionTo(STATE_MQTT_CONNECTING, now);
        } else {
            transitionTo(STATE_PPP_CONNECTING, now);
        }

        degradedBackoff.increment();
    }
}

void transitionTo(SystemState newState, unsigned long now) {
    if (currentState == newState) {
        return;
    }

    const char* stateNames[] = {
        "STATE_MODEM_INIT",
        "STATE_PPP_CONNECTING",
        "STATE_PPP_UP",
        "STATE_MQTT_CONNECTING",
        "STATE_MQTT_CONNECTED",
        "STATE_DEGRADED"
    };

    Serial.print("[Main] State transition: ");
    Serial.print(stateNames[currentState]);
    Serial.print(" -> ");
    Serial.print(stateNames[newState]);
    Serial.print(" (time in state: ");
    Serial.print(now - stateEntryTime);
    Serial.println("ms)");

    currentState = newState;
    stateEntryTime = now;
}

void handleCommand(const char* topic, const char* payload) {
    Serial.print("[Main] Command received on topic: ");
    Serial.println(topic);

    CommandResult cmd;
    if (!Protocol::parseCommand(payload, cmd)) {
        Serial.println("[Main] Failed to parse command");
        return;
    }

    Serial.print("[Main] Parsed command - requestId: ");
    Serial.print(cmd.requestId);
    Serial.print(", command: ");
    Serial.print(cmd.command);
    Serial.print(", userId: ");
    Serial.println(cmd.userId);

    // Handle command
    bool ackOk = false;
    const char* errorCode = nullptr;

    if (strcmp(cmd.command, "open") == 0) {
        // For now, just acknowledge (no GPIO logic yet)
        ackOk = true;
        Serial.println("[Main] Command 'open' acknowledged (GPIO not implemented yet)");
    } else {
        ackOk = false;
        errorCode = "UNKNOWN_COMMAND";
        Serial.print("[Main] Unknown command: ");
        Serial.println(cmd.command);
    }

    // Publish ACK
    Protocol::createAck(cmd.requestId, ackOk, errorCode, ackBuffer, sizeof(ackBuffer));

    if (mqttManager.publish(MQTT_ACK_TOPIC, ackBuffer, false)) {
        Serial.print("[Main] ACK published: ");
        Serial.println(ackBuffer);
    } else {
        Serial.println("[Main] Failed to publish ACK");
    }
}

void publishStatus(unsigned long now) {
    // Get RSSI if available (placeholder for now)
    int rssi = 0;  // TODO: Get actual RSSI from modem

    Protocol::createStatus(DEVICE_ID, true, now, rssi, FW_VERSION,
                          statusBuffer, sizeof(statusBuffer));

    if (mqttManager.publish(MQTT_STATUS_TOPIC, statusBuffer, false)) {
        Serial.print("[Main] Status published: ");
        Serial.println(statusBuffer);
    } else {
        Serial.println("[Main] Failed to publish status");
    }
}

