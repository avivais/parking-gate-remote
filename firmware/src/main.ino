#include <Arduino.h>
#include "tinygsm_pre.h"  // MUST be first - defines TINY_GSM_MODEM_A7670 before any TinyGSM includes
#include "utilities.h"  // Board pin definitions
#include "config/config.h"
#include "config/ProductionRootCA.h"  // Root CA certificate for Production MQTT TLS
#include "modem/ModemManager.h"
#include "ppp/PppManager.h"
#include "mqtt/MqttManager.h"
#include "relay/relay.h"
#include "gate_control/gate_control.h"
#include "protocol/Protocol.h"
#if DIAGNOSTIC_LOG_ENABLED
#include "util/DiagnosticLog.h"
#endif
#include <ArduinoJson.h>  // For parsing requestId from invalid JSON
#include <WiFi.h>  // For WiFiClient (works with PPP if initialized)

// Disable watchdog timer to prevent boot loops
#include "esp_task_wdt.h"

// Production firmware - no test configuration needed

// Global manager pointers (initialized in setup to avoid constructor issues)
ModemManager* modemManager = nullptr;
PppManager* pppManager = nullptr;
MqttManager* mqttManager = nullptr;

// State tracking
enum DeviceState {
    STATE_MODEM_INIT,
    STATE_PPP_CONNECTING,
    STATE_PPP_UP,
    STATE_MQTT_CONNECTING,
    STATE_MQTT_CONNECTED
};

DeviceState deviceState = STATE_MODEM_INIT;
unsigned long stateEntryTime = 0;
unsigned long lastPublishTime = 0;
const unsigned long PUBLISH_INTERVAL = 5000; // Publish every 5 seconds
int messageCount = 0;

// Recovery: when we escalate from MQTT to PPP rebuild, force PPP to start fresh
static bool forcePppRestart = false;
// Modem init retry cap: count failures, then back off before retrying
static int modemInitRetries = 0;

#if DIAGNOSTIC_LOG_ENABLED
static DiagnosticLog diagnosticLog;
static uint32_t bootSessionId = 0;
#endif

void setup() {
    // CRITICAL: Disable watchdog timer first to prevent boot loops
    disableCore0WDT();
    disableCore1WDT();
    esp_task_wdt_init(30, false);  // 30 second timeout, don't panic on timeout

    // Initialize serial immediately
    Serial.begin(115200);
    delay(500);  // Short delay for serial to initialize

    // Print early to confirm we got past global constructors
    Serial.println();
    Serial.println("========================================");
    Serial.println("Parking Gate Remote - Production Firmware");
    Serial.println("Cellular Connectivity via Cellcom Israel");
    Serial.println("========================================");
    Serial.flush();
    delay(500);

    // Print verbose configuration values
    Serial.println();
    Serial.println("=== CONFIGURATION VALUES ===");
    Serial.print("Device ID: ");
    Serial.println(DEVICE_ID);
    Serial.print("FW Version: ");
    Serial.println(FW_VERSION);
    Serial.println();
    Serial.println("--- Cellular/PPP Configuration ---");
    Serial.print("APN: ");
    Serial.println(CELLULAR_APN);
    Serial.print("APN Username: ");
    Serial.println(CELLULAR_USERNAME[0] ? CELLULAR_USERNAME : "(empty)");
    Serial.print("APN Password: ");
    Serial.println(CELLULAR_PASSWORD[0] ? "***" : "(empty)");
    Serial.print("PPP Timeout: ");
    Serial.print(PPP_TIMEOUT_MS);
    Serial.println(" ms");
    Serial.println();
    Serial.println("--- Modem Configuration ---");
    Serial.print("UART: Serial1");
    Serial.println();
    Serial.print("UART Baud: ");
    Serial.println(MODEM_UART_BAUD);
    Serial.print("TX Pin: ");
    Serial.println(MODEM_TX_PIN);
    Serial.print("RX Pin: ");
    Serial.println(MODEM_RX_PIN);
    #ifdef BOARD_POWERON_PIN
    Serial.print("BOARD_POWERON Pin: ");
    Serial.println(BOARD_POWERON_PIN);
    #endif
    Serial.print("RESET Pin: ");
    Serial.println(MODEM_RESET_PIN);
    Serial.print("RESET Level: ");
    Serial.println(MODEM_RESET_LEVEL == HIGH ? "HIGH" : "LOW");
    Serial.print("PWRKEY Pin: ");
    Serial.println(BOARD_PWRKEY_PIN);
    #ifdef MODEM_DTR_PIN
    Serial.print("DTR Pin: ");
    Serial.println(MODEM_DTR_PIN);
    #endif
    Serial.print("AT Init Timeout: ");
    Serial.print(AT_INIT_TIMEOUT_MS);
    Serial.println(" ms");
    Serial.print("AT CMD Timeout: ");
    Serial.print(AT_CMD_TIMEOUT_MS);
    Serial.println(" ms");
    Serial.println();
    Serial.println("--- MQTT Configuration (Production) ---");
    Serial.print("MQTT Host: ");
    Serial.println(MQTT_HOST);
    Serial.print("MQTT Port: ");
    Serial.println(MQTT_PORT);
    Serial.print("MQTT Username: ");
    Serial.println(MQTT_USERNAME);
    Serial.print("MQTT Password: ");
    Serial.println(MQTT_PASSWORD[0] ? "***" : "(empty)");
    Serial.print("MQTT CMD Topic: ");
    Serial.println(MQTT_CMD_TOPIC);
    Serial.print("MQTT ACK Topic: ");
    Serial.println(MQTT_ACK_TOPIC);
    Serial.print("MQTT Status Topic: ");
    Serial.println(MQTT_STATUS_TOPIC);
    Serial.print("Status Interval: ");
    Serial.print(STATUS_INTERVAL_MS);
    Serial.println(" ms");
    Serial.println();
    Serial.println("--- Recovery Configuration ---");
    Serial.print("MQTT Fails Before PPP Rebuild: ");
    Serial.println(MQTT_FAILS_BEFORE_PPP_REBUILD);
    Serial.print("PPP Fails Before Modem Reset: ");
    Serial.println(PPP_FAILS_BEFORE_MODEM_RESET);
    Serial.print("Backoff Base: ");
    Serial.print(BACKOFF_BASE_MS);
    Serial.println(" ms");
    Serial.print("Backoff Max: ");
    Serial.print(BACKOFF_MAX_MS);
    Serial.println(" ms");
    Serial.print("Cold Boot Delay: ");
    Serial.print(COLD_BOOT_DELAY_MS);
    Serial.println(" ms");
    Serial.print("Modem Init Max Retries: ");
    Serial.println(MODEM_INIT_MAX_RETRIES);
    Serial.print("Modem Init Backoff: ");
    Serial.print(MODEM_INIT_BACKOFF_MS);
    Serial.println(" ms");
    Serial.println("========================================");
    Serial.flush();
    delay(500);

    Serial.println("[Device] Setup() started successfully");
    Serial.println("[Device] Initializing managers...");
    Serial.flush();

    // Create managers dynamically to avoid constructor issues during global init
    Serial.println("[Device] Creating ModemManager...");
    Serial.flush();
    delay(200);  // Give watchdog time

    modemManager = new ModemManager();
    Serial.println("[Device] ModemManager created successfully");
    Serial.flush();
    delay(200);

    Serial.println("[Device] Creating PppManager...");
    Serial.flush();
    delay(200);

    pppManager = new PppManager(modemManager);
    Serial.println("[Device] PppManager created successfully");
    Serial.flush();
    delay(200);

    Serial.println("[Device] Creating MqttManager...");
    Serial.flush();
    delay(200);

    mqttManager = new MqttManager();
    Serial.println("[Device] MqttManager created successfully");
    Serial.flush();
    delay(200);

    Serial.println("[Device] All managers created");
    Serial.flush();

    // Initialize relay and gate control
    Serial.println("[Device] Initializing relay and gate control...");
    Relay::init();
    GateControl::init();
    Serial.println("[Device] Relay and gate control initialized");
    Serial.flush();

    // Cold boot: wait for modem power rail to stabilize before any modem GPIO activity
    Serial.print("[Device] Cold boot delay ");
    Serial.print(COLD_BOOT_DELAY_MS);
    Serial.println(" ms...");
    Serial.flush();
    delay(COLD_BOOT_DELAY_MS);
    Serial.println("[Device] Cold boot delay complete");
    Serial.flush();

    // Note: setPppManager() will be called after PPP is up (when TinyGSM modem is created)
    // MQTT will be initialized with production settings from config.h after PPP is up

    stateEntryTime = millis();
    Serial.println("[Device] Starting in STATE_MODEM_INIT state");
    Serial.flush();
}

void loop() {
    // Safety check
    if (modemManager == nullptr || pppManager == nullptr || mqttManager == nullptr) {
        Serial.println("[Device] ERROR: Managers not initialized!");
        delay(1000);
        return;
    }

    unsigned long now = millis();

    // Process MQTT messages if connected
    if (deviceState == STATE_MQTT_CONNECTED) {
        mqttManager->loop();
    }

    // Feed watchdog regularly
    yield();

    // State machine
    switch (deviceState) {
        case STATE_MODEM_INIT:
            // Modem initialization
            if (modemManager->init()) {
                Serial.println("[Device] Modem initialized, starting PPP...");
                modemInitRetries = 0;
                deviceState = STATE_PPP_CONNECTING;
                stateEntryTime = now;
            } else if (now - stateEntryTime > AT_INIT_TIMEOUT_MS) {
                if (modemInitRetries < MODEM_INIT_MAX_RETRIES) {
                    Serial.println("[Device] Modem init timeout, power cycle retry...");
#if DIAGNOSTIC_LOG_ENABLED
                    char msg[12];
                    snprintf(msg, sizeof(msg), "retry=%d", modemInitRetries + 1);
                    diagnosticLog.append(DiagnosticLevel::Warn, "init_retry", msg);
#endif
                    modemManager->powerCycle();
                    modemInitRetries++;
                    stateEntryTime = now;
                } else {
#if DIAGNOSTIC_LOG_ENABLED
                    char msg[16];
                    snprintf(msg, sizeof(msg), "backoff=%lu", (unsigned long)MODEM_INIT_BACKOFF_MS);
                    diagnosticLog.append(DiagnosticLevel::Warn, "backoff", msg);
#endif
                    Serial.print("[Device] Modem init max retries reached, backing off ");
                    Serial.print(MODEM_INIT_BACKOFF_MS);
                    Serial.println(" ms...");
                    delay(MODEM_INIT_BACKOFF_MS);
                    modemInitRetries = 0;
                    stateEntryTime = millis();
                }
            }
            break;

        case STATE_PPP_CONNECTING:
            {
                static bool pppStarted = false;
                if (forcePppRestart) {
                    pppStarted = false;
                    forcePppRestart = false;
                }
                if (!pppStarted) {
                    if (pppManager->start()) {
                        pppStarted = true;
                    }
                }

                if (pppManager->waitForPppUp(PPP_TIMEOUT_MS)) {
                    Serial.println("[Device] PPP connected!");
                    pppManager->resetPppFailStreak();
                    deviceState = STATE_PPP_UP;
                    pppStarted = false;
                } else if (now - stateEntryTime > PPP_TIMEOUT_MS) {
                    Serial.println("[Device] PPP connection timeout, retrying...");
                    pppManager->stop();
                    pppStarted = false;
                    if (pppManager->shouldHardReset()) {
                        Serial.println("[Device] PPP failure threshold exceeded, modem hard reset...");
#if DIAGNOSTIC_LOG_ENABLED
                        char msg[8];
                        snprintf(msg, sizeof(msg), "n=%d", (int)pppManager->getPppFailStreak());
                        diagnosticLog.append(DiagnosticLevel::Warn, "modem_reset", msg);
#endif
                        modemManager->hardReset();
                        pppManager->resetPppFailStreak();
                        deviceState = STATE_MODEM_INIT;
                    }
                    stateEntryTime = now;
                }
            }
            break;

        case STATE_PPP_UP:
            {
                // Give PPP a moment to stabilize
                static unsigned long pppUpTime = 0;
                static bool mqttSetup = false;
                static bool mqttInitialized = false;

                if (pppUpTime == 0) {
                    pppUpTime = now;
                    Serial.println("[Device] PPP up, setting up MQTT...");
                }

                // Step 1: Link MqttManager to PppManager (now that TinyGSM modem exists)
                if (!mqttSetup && (now - pppUpTime > 1000)) {
                    Serial.println("[Device] Linking MqttManager to PppManager...");
                    mqttManager->setPppManager(pppManager);
                    mqttManager->begin(MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD);
                    mqttSetup = true;
                }

                // Step 2: Initialize modem MQTT with TLS (like POC)
                if (mqttSetup && !mqttInitialized && (now - pppUpTime > 2000)) {
                    Serial.println("[Device] Initializing modem MQTT with TLS...");
                    if (mqttManager->initializeModemMqtt(true, true, ProductionRootCA)) {
                        Serial.println("[Device] Modem MQTT initialized with TLS");
                        mqttInitialized = true;
                    } else {
                        Serial.println("[Device] ERROR: Failed to initialize modem MQTT");
                    }
                }

                // Step 3: Proceed to connect
                if (mqttInitialized && (now - pppUpTime > 3000)) {
                    Serial.println("[Device] Network ready, connecting to MQTT...");
                    deviceState = STATE_MQTT_CONNECTING;
                    stateEntryTime = now;
                    pppUpTime = 0;
                    mqttSetup = false;
                    mqttInitialized = false;
                }
            }
            break;

        case STATE_MQTT_CONNECTING:
            // Before retrying MQTT, check if we should escalate to PPP rebuild
            if (mqttManager->shouldRebuildPpp()) {
                Serial.println("[Device] MQTT fail threshold exceeded, rebuilding PPP...");
#if DIAGNOSTIC_LOG_ENABLED
                char msg[8];
                snprintf(msg, sizeof(msg), "n=%d", (int)mqttManager->getMqttFailStreak());
                diagnosticLog.append(DiagnosticLevel::Warn, "ppp_rebuild", msg);
#endif
                mqttManager->disconnect();
                mqttManager->resetMqttFailStreak();
                pppManager->stop();
                forcePppRestart = true;
                deviceState = STATE_PPP_CONNECTING;
                stateEntryTime = now;
                break;
            }
            if (mqttManager->connect()) {
                Serial.println("[Device] MQTT connected!");
                mqttManager->setCommandCallback(handleMqttCommand);
                Serial.println("[Device] Command callback registered");
#if DIAGNOSTIC_LOG_ENABLED
                diagnosticLog.append(DiagnosticLevel::Info, "connection_restored", nullptr);
                if (diagnosticLog.hasEntries()) {
                    if (bootSessionId == 0) bootSessionId = millis() + (uint32_t)random(0xFFFF);
                    const size_t batchSize = 10;
                    while (diagnosticLog.hasEntries()) {
                        DynamicJsonDocument doc(1024);
                        doc["deviceId"] = DEVICE_ID;
                        doc["fwVersion"] = FW_VERSION;
                        doc["sessionId"] = bootSessionId;
                        JsonArray arr = doc.createNestedArray("entries");
                        char eventBuf[DIAG_EVENT_LEN], messageBuf[DIAG_MESSAGE_LEN];
                        size_t batchCount = 0;
                        for (size_t i = 0; i < batchSize; i++) {
                            uint32_t ts;
                            uint8_t lvl;
                            if (!diagnosticLog.getEntry(i, &ts, &lvl, eventBuf, sizeof(eventBuf), messageBuf, sizeof(messageBuf)))
                                break;
                            JsonObject e = arr.createNestedObject();
                            e["ts"] = ts;
                            e["level"] = lvl == 0 ? "info" : (lvl == 1 ? "warn" : "error");
                            e["event"] = eventBuf;
                            if (messageBuf[0]) e["message"] = messageBuf;
                            batchCount++;
                        }
                        if (batchCount == 0) break;
                        String payload;
                        serializeJson(doc, payload);
                        if (mqttManager->publish(MQTT_DIAGNOSTICS_TOPIC, payload.c_str())) {
                            Serial.println("[Device] Diagnostic log batch published");
                            diagnosticLog.removeFirst(batchCount);
                        } else {
                            break;
                        }
                    }
                }
#endif
                deviceState = STATE_MQTT_CONNECTED;
                stateEntryTime = now;
            }
            break;

        case STATE_MQTT_CONNECTED:
            mqttManager->publishStatus();

            if (!mqttManager->isConnected()) {
                Serial.println("[Device] MQTT connection lost, reconnecting...");
#if DIAGNOSTIC_LOG_ENABLED
                diagnosticLog.append(DiagnosticLevel::Warn, "connection_lost", nullptr);
#endif
                deviceState = STATE_MQTT_CONNECTING;
                stateEntryTime = now;
            }
            break;
    }

    delay(10);
}

void testConnectivity() {
    Serial.println("[Device] ========================================");
    Serial.println("[Device] Testing Cellular Internet Connectivity");
    Serial.println("[Device] ========================================");

    // CRITICAL: WiFiClient uses WiFi's DNS resolver, which doesn't work
    // without ESP32 PPP stack initialized. This test will likely fail
    // until we properly initialize the ESP32 PPP stack.

    // Test 1: Try DNS resolution via modem (if supported)
    Serial.println("[Device] Test 1: DNS Resolution via Modem AT Command");
    if (modemManager != nullptr) {
        Serial.println("[Device] Attempting DNS lookup via modem...");
        // Try to resolve www.google.com using modem's DNS
        // Note: A7670 may support AT+CDNSGIP command for DNS resolution
        if (modemManager->sendATCommand("AT+CDNSGIP=1,\"www.google.com\"", "OK", 5000)) {
            Serial.println("[Device] DNS resolution via modem: SUCCESS");
        } else {
            Serial.println("[Device] DNS resolution via modem: NOT SUPPORTED or FAILED");
            Serial.println("[Device] Modem may not support AT+CDNSGIP command");
        }
    }
    Serial.println();

    // Test 2: Try to resolve DNS and connect to www.google.com via ESP32
    // This will fail if ESP32 PPP stack is not initialized
    Serial.println("[Device] Test 2: DNS Resolution + HTTP GET via ESP32");
    Serial.println("[Device] NOTE: This requires ESP32 PPP stack to be initialized");
    Serial.print("[Device] Attempting to connect to www.google.com:80...");
    Serial.flush();

    // Use WiFiClient (works with PPP if PPP stack is initialized)
    // Note: This is a connectivity test, not WiFi-specific
    WiFiClient testClient;

    unsigned long startTime = millis();
    bool connected = testClient.connect("www.google.com", 80);
    unsigned long connectTime = millis() - startTime;

    if (connected) {
        Serial.println(" SUCCESS!");
        Serial.print("[Device] Connection time: ");
        Serial.print(connectTime);
        Serial.println(" ms");

        // Send HTTP GET request
        Serial.println("[Device] Sending HTTP GET request...");
        testClient.println("GET / HTTP/1.1");
        testClient.println("Host: www.google.com");
        testClient.println("Connection: close");
        testClient.println();

        // Wait for response
        unsigned long timeout = millis() + 5000;
        bool gotResponse = false;
        int responseCode = 0;

        while (millis() < timeout && testClient.connected()) {
            if (testClient.available()) {
                String line = testClient.readStringUntil('\n');
                line.trim();

                if (line.startsWith("HTTP/")) {
                    // Parse response code
                    int space1 = line.indexOf(' ');
                    int space2 = line.indexOf(' ', space1 + 1);
                    if (space1 > 0 && space2 > 0) {
                        responseCode = line.substring(space1 + 1, space2).toInt();
                    }
                    Serial.print("[Device] HTTP Response: ");
                    Serial.println(line);
                    gotResponse = true;
                } else if (line.length() > 0 && !gotResponse) {
                    Serial.print("[Device] Response header: ");
                    Serial.println(line);
                }

                // Read a few more lines to verify connection
                if (gotResponse && responseCode > 0) {
                    break;
                }
            }
            delay(10);
            yield();
        }

        if (gotResponse) {
            Serial.print("[Device] HTTP Status Code: ");
            Serial.println(responseCode);
            if (responseCode == 200 || responseCode == 301 || responseCode == 302) {
                Serial.println("[Device] ✓ Internet connectivity: WORKING");
                Serial.println("[Device] ✓ DNS resolution: WORKING");
                Serial.println("[Device] ✓ HTTP connectivity: WORKING");
            } else {
                Serial.print("[Device] ⚠ Got HTTP ");
                Serial.print(responseCode);
                Serial.println(" (unexpected)");
            }
        } else {
            Serial.println("[Device] ⚠ Connected but no HTTP response received");
        }

        testClient.stop();
        Serial.println("[Device] Connection closed");
    } else {
        Serial.println(" FAILED!");
        Serial.print("[Device] Connection attempt took: ");
        Serial.print(connectTime);
        Serial.println(" ms");

        int errorCode = testClient.getWriteError();
        Serial.print("[Device] Error code: ");
        Serial.println(errorCode);

        if (errorCode == -11) {
            Serial.println("[Device] ✗ DNS resolution FAILED (hostname not resolved)");
            Serial.println("[Device] This indicates ESP32 PPP stack is not initialized");
            Serial.println("[Device] Network interface cannot resolve DNS");
        } else {
            Serial.println("[Device] ✗ Connection FAILED (network unreachable)");
        }
    }

    Serial.println("[Device] ========================================");
    Serial.flush();
    delay(500);
}

/**
 * Handle incoming MQTT command messages.
 * Processes gate open commands with validation, cooldown, dedupe, and relay control.
 */
void handleMqttCommand(const char* topic, const char* payload) {
    if (mqttManager == nullptr || !mqttManager->isConnected()) {
        Serial.println("[Gate] ERROR: Cannot handle command - MQTT not connected");
        return;
    }

    Serial.print("[Gate] Command received on topic: ");
    Serial.print(topic);
    Serial.print(", payload: ");
    Serial.println(payload);

    // Parse command JSON
    CommandResult cmd;
    if (!Protocol::parseCommand(payload, cmd)) {
        Serial.println("[Gate] Invalid payload - attempting to extract requestId for BAD_PAYLOAD ACK");
        char ackJson[256];
        // Try to extract requestId from raw JSON for error reporting
        char requestId[37] = "";
        StaticJsonDocument<256> errorDoc;
        DeserializationError error = deserializeJson(errorDoc, payload);
        if (!error && errorDoc.containsKey("requestId") && errorDoc["requestId"].is<const char*>()) {
            strncpy(requestId, errorDoc["requestId"].as<const char*>(), sizeof(requestId) - 1);
            requestId[sizeof(requestId) - 1] = '\0';
        }
        Protocol::createAck(requestId[0] != '\0' ? requestId : "", false, "BAD_PAYLOAD", ackJson, sizeof(ackJson));
        mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false);
        return;
    }

    // Validate requestId is non-empty
    if (cmd.requestId[0] == '\0') {
        Serial.println("[Gate] Empty requestId - publishing BAD_PAYLOAD ACK");
        char ackJson[256];
        Protocol::createAck(cmd.requestId, false, "BAD_PAYLOAD", ackJson, sizeof(ackJson));
        mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false);
        return;
    }

    Serial.print("[Gate] Parsed command: requestId=");
    Serial.print(cmd.requestId);
    Serial.print(", command=");
    Serial.print(cmd.command);
    Serial.print(", userId=");
    Serial.print(cmd.userId);
    Serial.print(", issuedAt=");
    Serial.println(cmd.issuedAt);

    // Check if command is "open"
    if (strcmp(cmd.command, "open") != 0) {
        Serial.print("[Gate] Unknown command: ");
        Serial.print(cmd.command);
        Serial.println(" - publishing UNKNOWN_COMMAND ACK");
        char ackJson[256];
        Protocol::createAck(cmd.requestId, false, "UNKNOWN_COMMAND", ackJson, sizeof(ackJson));
        mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false);
        return;
    }

    // Check dedupe (idempotency)
    if (GateControl::wasProcessed(cmd.requestId)) {
        Serial.print("[Gate] Dedupe hit for requestId: ");
        Serial.print(cmd.requestId);
        Serial.println(" - publishing idempotent success ACK");
        char ackJson[256];
        Protocol::createAck(cmd.requestId, true, nullptr, ackJson, sizeof(ackJson));
        mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false);
        Serial.print("[Gate] ACK published: ok=true (idempotent) for requestId ");
        Serial.println(cmd.requestId);
        return;
    }

    // Check cooldown
    uint32_t nowMs = millis();
    uint32_t remainingMs = 0;
    if (!GateControl::canExecuteNow(nowMs, remainingMs)) {
        Serial.print("[Gate] Cooldown active - remaining: ");
        Serial.print(remainingMs);
        Serial.println("ms - publishing COOLDOWN ACK");
        char ackJson[256];
        Protocol::createAck(cmd.requestId, false, "COOLDOWN", ackJson, sizeof(ackJson));
        mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false);
        Serial.print("[Gate] ACK published: ok=false, errorCode=COOLDOWN for requestId ");
        Serial.println(cmd.requestId);
        return;
    }

    // Activate relay
    Serial.println("[Gate] Activating relay pulse...");
    bool relaySuccess = Relay::activatePulse();

    if (relaySuccess) {
        // Record gate open and mark request as processed
        GateControl::recordOpen(nowMs);
        GateControl::markProcessed(cmd.requestId);

        // Publish success ACK
        char ackJson[256];
        Protocol::createAck(cmd.requestId, true, nullptr, ackJson, sizeof(ackJson));
        if (mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false)) {
            Serial.print("[Gate] ACK published: ok=true for requestId ");
            Serial.println(cmd.requestId);
        } else {
            Serial.println("[Gate] ERROR: Failed to publish ACK");
        }
    } else {
        // Publish failure ACK
        Serial.println("[Gate] Relay activation failed - publishing RELAY_FAIL ACK");
        char ackJson[256];
        Protocol::createAck(cmd.requestId, false, "RELAY_FAIL", ackJson, sizeof(ackJson));
        mqttManager->publish(MQTT_ACK_TOPIC, ackJson, false);
        Serial.print("[Gate] ACK published: ok=false, errorCode=RELAY_FAIL for requestId ");
        Serial.println(cmd.requestId);
    }
}
