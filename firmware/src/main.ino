#include <Arduino.h>
#include "tinygsm_pre.h"  // MUST be first - defines TINY_GSM_MODEM_A7670 before any TinyGSM includes
#include "utilities.h"  // Board pin definitions
#include "config/config.h"
#include "config/HivemqRootCA.h"  // Root CA certificate for HiveMQ TLS
#include "modem/ModemManager.h"
#include "ppp/PppManager.h"
#include "mqtt/MqttManager.h"
#include <WiFi.h>  // For WiFiClient (works with PPP if initialized)

// Disable watchdog timer to prevent boot loops
#include "esp_task_wdt.h"

// Test MQTT Configuration (HiveMQ Cloud)
#define TEST_MQTT_HOST "3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud"
#define TEST_MQTT_PORT 8883
#define TEST_MQTT_USERNAME "avivais"
#define TEST_MQTT_PASSWORD "Avivr_121"

#define TEST_MQTT_TOPIC_INCOMING "test-incoming"
#define TEST_MQTT_TOPIC_SENT "test-sent-message"

// Test mode: Skip modem hardware initialization (set to 0 to enable modem)
#define TEST_SKIP_MODEM_HARDWARE 0

// Global manager pointers (initialized in setup to avoid constructor issues)
ModemManager* modemManager = nullptr;
PppManager* pppManager = nullptr;
MqttManager* mqttManager = nullptr;

// State tracking
enum TestState {
    TEST_MODEM_INIT,
    TEST_PPP_CONNECTING,
    TEST_PPP_UP,
    TEST_MQTT_CONNECTING,
    TEST_MQTT_CONNECTED
};

TestState testState = TEST_MODEM_INIT;
unsigned long stateEntryTime = 0;
unsigned long lastPublishTime = 0;
const unsigned long PUBLISH_INTERVAL = 5000; // Publish every 5 seconds
int messageCount = 0;

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
    Serial.println("MQTT Test Firmware - Cellular Only");
    Serial.println("Using Cellcom Israel APN");
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
    Serial.println("--- MQTT Configuration (from config.h) ---");
    Serial.print("MQTT Host: ");
    Serial.println(MQTT_HOST);
    Serial.print("MQTT Port: ");
    Serial.println(MQTT_PORT);
    Serial.print("MQTT Username: ");
    Serial.println(MQTT_USERNAME);
    Serial.print("MQTT Password: ");
    Serial.println(MQTT_PASSWORD[0] ? "***" : "(empty)");
    Serial.println();
    Serial.println("--- Test MQTT Configuration (will be used) ---");
    Serial.print("Test MQTT Host: ");
    Serial.println(TEST_MQTT_HOST);
    Serial.print("Test MQTT Port: ");
    Serial.println(TEST_MQTT_PORT);
    Serial.print("Test MQTT Username: ");
    Serial.println(TEST_MQTT_USERNAME);
    Serial.print("Test MQTT Password: ");
    Serial.println(TEST_MQTT_PASSWORD[0] ? "***" : "(empty)");
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
    Serial.println();
    Serial.println("--- Test Mode Configuration ---");
    #if TEST_SKIP_MODEM_HARDWARE
    Serial.println("TEST_SKIP_MODEM_HARDWARE: ENABLED (modem hardware init skipped)");
    #else
    Serial.println("TEST_SKIP_MODEM_HARDWARE: DISABLED (modem hardware init enabled)");
    #endif
    Serial.println("========================================");
    Serial.flush();
    delay(500);

    Serial.println("[Test] Setup() started successfully");
    Serial.println("[Test] Initializing managers...");
    Serial.flush();

    // Create managers dynamically to avoid constructor issues during global init
    Serial.println("[Test] Creating ModemManager...");
    Serial.flush();
    delay(200);  // Give watchdog time

    modemManager = new ModemManager();
    Serial.println("[Test] ModemManager created successfully");
    Serial.flush();
    delay(200);

    Serial.println("[Test] Creating PppManager...");
    Serial.flush();
    delay(200);

    pppManager = new PppManager(modemManager);
    Serial.println("[Test] PppManager created successfully");
    Serial.flush();
    delay(200);

    Serial.println("[Test] Creating MqttManager...");
    Serial.flush();
    delay(200);

    mqttManager = new MqttManager();
    Serial.println("[Test] MqttManager created successfully");
    Serial.flush();
    delay(200);

    Serial.println("[Test] All managers created");
    Serial.flush();

    // Note: setPppManager() will be called after PPP is up (when TinyGSM modem is created)
    // For now, just initialize with settings
    Serial.println("[Test] Initializing MQTT manager with test settings...");
    Serial.print("[Test] Test MQTT Host: ");
    Serial.println(TEST_MQTT_HOST);
    Serial.print("[Test] Test MQTT Port: ");
    Serial.println(TEST_MQTT_PORT);

    stateEntryTime = millis();
    Serial.println("[Test] Starting in TEST_MODEM_INIT state");
    Serial.flush();
}

void loop() {
    // Safety check
    if (modemManager == nullptr || pppManager == nullptr || mqttManager == nullptr) {
        Serial.println("[Test] ERROR: Managers not initialized!");
        delay(1000);
        return;
    }

    unsigned long now = millis();

    // Process MQTT messages if connected
    if (testState == TEST_MQTT_CONNECTED) {
        mqttManager->loop();
    }

    // Feed watchdog regularly
    yield();

    // State machine
    switch (testState) {
        case TEST_MODEM_INIT:
            #if TEST_SKIP_MODEM_HARDWARE
            // Skip modem hardware initialization for testing without hardware
            Serial.println("[Test] Skipping modem hardware init (TEST_SKIP_MODEM_HARDWARE=1)");
            Serial.println("[Test] Moving directly to MQTT_CONNECTING state");
            Serial.println("[Test] Note: MQTT will fail without network, but firmware is stable");
            testState = TEST_MQTT_CONNECTING;
            stateEntryTime = now;
            #else
            // Normal modem initialization
            if (modemManager->init()) {
                Serial.println("[Test] Modem initialized, starting PPP...");
                testState = TEST_PPP_CONNECTING;
                stateEntryTime = now;
            } else if (now - stateEntryTime > AT_INIT_TIMEOUT_MS) {
                Serial.println("[Test] Modem init timeout, retrying...");
                modemManager->powerCycle();
                stateEntryTime = now;
            }
            #endif
            break;

        case TEST_PPP_CONNECTING:
            {
                static bool pppStarted = false;
                if (!pppStarted) {
                    if (pppManager->start()) {
                        pppStarted = true;
                    }
                }

                if (pppManager->waitForPppUp(PPP_TIMEOUT_MS)) {
                    Serial.println("[Test] PPP connected!");
                    testState = TEST_PPP_UP;
                    pppStarted = false;
                } else if (now - stateEntryTime > PPP_TIMEOUT_MS) {
                    Serial.println("[Test] PPP connection timeout, retrying...");
                    pppManager->stop();
                    pppStarted = false;
                    stateEntryTime = now;
                }
            }
            break;

        case TEST_PPP_UP:
            {
                // Give PPP a moment to stabilize
                static unsigned long pppUpTime = 0;
                static bool mqttSetup = false;
                static bool mqttInitialized = false;

                if (pppUpTime == 0) {
                    pppUpTime = now;
                    Serial.println("[Test] PPP up, setting up MQTT...");
                }

                // Step 1: Link MqttManager to PppManager (now that TinyGSM modem exists)
                if (!mqttSetup && (now - pppUpTime > 1000)) {
                    Serial.println("[Test] Linking MqttManager to PppManager...");
                    mqttManager->setPppManager(pppManager);
                    mqttManager->begin(TEST_MQTT_HOST, TEST_MQTT_PORT, TEST_MQTT_USERNAME, TEST_MQTT_PASSWORD);
                    mqttSetup = true;
                }

                // Step 2: Initialize modem MQTT with TLS (like POC)
                if (mqttSetup && !mqttInitialized && (now - pppUpTime > 2000)) {
                    Serial.println("[Test] Initializing modem MQTT with TLS...");
                    if (mqttManager->initializeModemMqtt(true, true, HivemqRootCA)) {
                        Serial.println("[Test] Modem MQTT initialized with TLS");
                        mqttInitialized = true;
                    } else {
                        Serial.println("[Test] ERROR: Failed to initialize modem MQTT");
                    }
                }

                // Step 3: Proceed to connect
                if (mqttInitialized && (now - pppUpTime > 3000)) {
                    Serial.println("[Test] Network ready, connecting to MQTT...");
                    testState = TEST_MQTT_CONNECTING;
                    stateEntryTime = now;
                    pppUpTime = 0;
                    mqttSetup = false;
                    mqttInitialized = false;
                }
            }
            break;

        case TEST_MQTT_CONNECTING:
            // Try to connect to MQTT broker
            if (mqttManager->connect()) {
                Serial.println("[Test] MQTT connected!");
                testState = TEST_MQTT_CONNECTED;
                stateEntryTime = now;
            } else {
                // Check timeout
                if (now - stateEntryTime > 30000) {  // 30 second timeout
                    Serial.println("[Test] MQTT connection timeout, retrying...");
                    stateEntryTime = now;
                }
            }
            break;

        case TEST_MQTT_CONNECTED:
            // Publish test message periodically
            if (now - lastPublishTime >= PUBLISH_INTERVAL) {
                publishTestMessage();
                lastPublishTime = now;
            }

            // Check connection health
            if (!mqttManager->isConnected()) {
                Serial.println("[Test] MQTT connection lost, reconnecting...");
                testState = TEST_MQTT_CONNECTING;
                stateEntryTime = now;
            }
            break;
    }

    delay(10);
}

void testConnectivity() {
    Serial.println("[Test] ========================================");
    Serial.println("[Test] Testing Cellular Internet Connectivity");
    Serial.println("[Test] ========================================");

    // CRITICAL: WiFiClient uses WiFi's DNS resolver, which doesn't work
    // without ESP32 PPP stack initialized. This test will likely fail
    // until we properly initialize the ESP32 PPP stack.

    // Test 1: Try DNS resolution via modem (if supported)
    Serial.println("[Test] Test 1: DNS Resolution via Modem AT Command");
    if (modemManager != nullptr) {
        Serial.println("[Test] Attempting DNS lookup via modem...");
        // Try to resolve www.google.com using modem's DNS
        // Note: A7670 may support AT+CDNSGIP command for DNS resolution
        if (modemManager->sendATCommand("AT+CDNSGIP=1,\"www.google.com\"", "OK", 5000)) {
            Serial.println("[Test] DNS resolution via modem: SUCCESS");
        } else {
            Serial.println("[Test] DNS resolution via modem: NOT SUPPORTED or FAILED");
            Serial.println("[Test] Modem may not support AT+CDNSGIP command");
        }
    }
    Serial.println();

    // Test 2: Try to resolve DNS and connect to www.google.com via ESP32
    // This will fail if ESP32 PPP stack is not initialized
    Serial.println("[Test] Test 2: DNS Resolution + HTTP GET via ESP32");
    Serial.println("[Test] NOTE: This requires ESP32 PPP stack to be initialized");
    Serial.print("[Test] Attempting to connect to www.google.com:80...");
    Serial.flush();

    // Use WiFiClient (works with PPP if PPP stack is initialized)
    // Note: This is a connectivity test, not WiFi-specific
    WiFiClient testClient;

    unsigned long startTime = millis();
    bool connected = testClient.connect("www.google.com", 80);
    unsigned long connectTime = millis() - startTime;

    if (connected) {
        Serial.println(" SUCCESS!");
        Serial.print("[Test] Connection time: ");
        Serial.print(connectTime);
        Serial.println(" ms");

        // Send HTTP GET request
        Serial.println("[Test] Sending HTTP GET request...");
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
                    Serial.print("[Test] HTTP Response: ");
                    Serial.println(line);
                    gotResponse = true;
                } else if (line.length() > 0 && !gotResponse) {
                    Serial.print("[Test] Response header: ");
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
            Serial.print("[Test] HTTP Status Code: ");
            Serial.println(responseCode);
            if (responseCode == 200 || responseCode == 301 || responseCode == 302) {
                Serial.println("[Test] ✓ Internet connectivity: WORKING");
                Serial.println("[Test] ✓ DNS resolution: WORKING");
                Serial.println("[Test] ✓ HTTP connectivity: WORKING");
            } else {
                Serial.print("[Test] ⚠ Got HTTP ");
                Serial.print(responseCode);
                Serial.println(" (unexpected)");
            }
        } else {
            Serial.println("[Test] ⚠ Connected but no HTTP response received");
        }

        testClient.stop();
        Serial.println("[Test] Connection closed");
    } else {
        Serial.println(" FAILED!");
        Serial.print("[Test] Connection attempt took: ");
        Serial.print(connectTime);
        Serial.println(" ms");

        int errorCode = testClient.getWriteError();
        Serial.print("[Test] Error code: ");
        Serial.println(errorCode);

        if (errorCode == -11) {
            Serial.println("[Test] ✗ DNS resolution FAILED (hostname not resolved)");
            Serial.println("[Test] This indicates ESP32 PPP stack is not initialized");
            Serial.println("[Test] Network interface cannot resolve DNS");
        } else {
            Serial.println("[Test] ✗ Connection FAILED (network unreachable)");
        }
    }

    Serial.println("[Test] ========================================");
    Serial.flush();
    delay(500);
}

void publishTestMessage() {
    if (mqttManager == nullptr || !mqttManager->isConnected()) {
        return;
    }

    messageCount++;

    // Create test message
    char message[128];
    snprintf(message, sizeof(message), "Test message #%d from ESP32 at %lu", messageCount, millis());

    // Note: Using status topic for test (update if needed)
    if (mqttManager->publish(MQTT_STATUS_TOPIC, message, false)) {
        Serial.print("[Test] Published: ");
        Serial.println(message);
    } else {
        Serial.println("[Test] Failed to publish message");
    }
}
