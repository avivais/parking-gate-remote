#include "MqttManager.h"
// Note: WiFiClient on ESP32 implements the Client interface and works with ANY network interface
// including PPP. We are NOT using WiFi - this is just the standard Client implementation for ESP32.
#include <WiFi.h>

MqttManager* MqttManager::instance = nullptr;

// Static network client instance
// WiFiClient is used here as it's ESP32's standard Client implementation that works with PPP
// No WiFi initialization or WiFi-specific code is used
static WiFiClient staticNetworkClient;

MqttManager::MqttManager()
    : networkClient(&staticNetworkClient), mqttClient(staticNetworkClient), backoff(BACKOFF_BASE_MS, BACKOFF_MAX_MS),
      connected(false), mqttFailStreak(0), lastConnectAttempt(0),
      lastStatusPublish(0), commandCallback(nullptr) {
    instance = this;
}

void MqttManager::begin() {
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setCallback(staticOnMessage);
    mqttClient.setKeepAlive(60);
    mqttClient.setSocketTimeout(5);
}

bool MqttManager::connect() {
    unsigned long now = millis();

    // If already connected, check connection health
    if (connected && mqttClient.connected()) {
        return true;
    }

    // Check if we should wait (backoff)
    if (lastConnectAttempt > 0 && (now - lastConnectAttempt) < backoff.getNextDelay()) {
        return false;
    }

    // Attempt connection
    lastConnectAttempt = now;

    Serial.print("[MQTT] Connecting to broker ");
    Serial.print(MQTT_HOST);
    Serial.print(":");
    Serial.print(MQTT_PORT);
    Serial.println("...");

    String clientId = String("pgr_device_") + String(DEVICE_ID) + String("_") + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
        Serial.println("[MQTT] Connected to broker");

        // Subscribe to command topic
        if (mqttClient.subscribe(MQTT_CMD_TOPIC, 1)) {
            Serial.print("[MQTT] Subscribed to ");
            Serial.println(MQTT_CMD_TOPIC);
        } else {
            Serial.println("[MQTT] Failed to subscribe to command topic");
            mqttClient.disconnect();
            incrementFailStreak();
            backoff.increment();
            return false;
        }

        connected = true;
        resetMqttFailStreak();
        backoff.reset();
        return true;
    } else {
        Serial.print("[MQTT] Connection failed, rc=");
        Serial.println(mqttClient.state());
        connected = false;
        incrementFailStreak();
        backoff.increment();

        Serial.print("[MQTT] Next retry in ");
        Serial.print(backoff.getNextDelay());
        Serial.println("ms");

        return false;
    }
}

void MqttManager::disconnect() {
    if (connected) {
        Serial.println("[MQTT] Disconnecting...");
        mqttClient.disconnect();
        connected = false;
    }
}

bool MqttManager::isConnected() const {
    // Note: mqttClient.connected() is not const, so we use the cached 'connected' flag
    // In a non-const context, we could check mqttClient.connected() directly
    return connected;
}

bool MqttManager::publish(const char* topic, const char* payload, bool retained) {
    if (!isConnected()) {
        Serial.println("[MQTT] Cannot publish: not connected");
        return false;
    }

    // Publish with QoS 1 as per protocol specification
    bool result = mqttClient.publish(topic, payload, retained);
    if (!result) {
        Serial.print("[MQTT] Failed to publish to ");
        Serial.println(topic);
    }
    return result;
}

void MqttManager::publishAck(const char* requestId, bool ok, const char* errorCode) {
    if (!isConnected()) {
        Serial.println("[MQTT] Cannot publish ACK: not connected");
        return;
    }

    // ACK will be created by caller using Protocol::createAck
    // This method is a placeholder for future use if needed
    Serial.print("[MQTT] ACK prepared for requestId: ");
    Serial.println(requestId);
}

void MqttManager::publishStatus() {
    if (!isConnected()) {
        return;
    }

    unsigned long now = millis();
    if (now - lastStatusPublish < STATUS_INTERVAL_MS) {
        return;
    }

    lastStatusPublish = now;

    // Status message will be created by caller using Protocol::createStatus
    // This method is a placeholder for future use if needed
}

void MqttManager::setCommandCallback(void (*callback)(const char* topic, const char* payload)) {
    commandCallback = callback;
}

void MqttManager::loop() {
    if (!connected) {
        return;
    }

    if (!mqttClient.loop()) {
        // Connection lost
        if (mqttClient.state() == -1) {
            Serial.println("[MQTT] Connection lost");
            connected = false;
            incrementFailStreak();
        }
    }
}

void MqttManager::onMessage(char* topic, uint8_t* payload, unsigned int length) {
    // Create null-terminated string from payload
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';

    Serial.print("[MQTT] Message received on topic: ");
    Serial.print(topic);
    Serial.print(", payload: ");
    Serial.println(message);

    if (commandCallback != nullptr) {
        commandCallback(topic, message);
    }
}

void MqttManager::staticOnMessage(char* topic, uint8_t* payload, unsigned int length) {
    if (instance != nullptr) {
        instance->onMessage(topic, payload, length);
    }
}

uint8_t MqttManager::getMqttFailStreak() const {
    return mqttFailStreak;
}

void MqttManager::resetMqttFailStreak() {
    if (mqttFailStreak > 0) {
        Serial.print("[MQTT] Resetting failure streak (was ");
        Serial.print(mqttFailStreak);
        Serial.println(")");
    }
    mqttFailStreak = 0;
}

void MqttManager::incrementFailStreak() {
    mqttFailStreak++;
    Serial.print("[MQTT] Failure streak: ");
    Serial.println(mqttFailStreak);

    if (shouldRebuildPpp()) {
        Serial.println("[MQTT] Failure threshold exceeded, will rebuild PPP");
    }
}

bool MqttManager::shouldRebuildPpp() const {
    return mqttFailStreak >= MQTT_FAILS_BEFORE_PPP_REBUILD;
}

Backoff& MqttManager::getBackoff() {
    return backoff;
}

