#include "tinygsm_pre.h"  // Must be before any TinyGSM includes
#include "utilities.h"
#include "MqttManager.h"
#include "ppp/PppManager.h"
#include <TinyGsm.h>  // For TinyGsm type
// TinyGSM is included via PppManager.h

MqttManager* MqttManager::instance = nullptr;

MqttManager::MqttManager()
    : backoff(BACKOFF_BASE_MS, BACKOFF_MAX_MS),
      connected(false), mqttFailStreak(0), lastConnectAttempt(0),
      lastStatusPublish(0), commandCallback(nullptr),
      pppManager(nullptr), modem(nullptr),
      customHost(nullptr), customPort(0), customUsername(nullptr), customPassword(nullptr),
      useCustomSettings(false), mqttClientId(0) {
    instance = this;
}

void MqttManager::setPppManager(PppManager* pppManager) {
    this->pppManager = pppManager;

    // Get TinyGsm modem from PppManager (for modem's built-in MQTT API)
    if (pppManager != nullptr) {
        modem = pppManager->getModem();
        if (modem != nullptr) {
            Serial.println("[MQTT] Using modem's built-in MQTT client (supports TLS/SSL)");
        } else {
            Serial.println("[MQTT] WARNING: Modem not available");
        }
    }
}

bool MqttManager::initializeModemMqtt(bool enableSSL, bool enableSNI, const char* rootCA) {
    if (modem == nullptr) {
        Serial.println("[MQTT] ERROR: Modem not available");
        return false;
    }

    Serial.println("[MQTT] Initializing modem MQTT client...");
    Serial.print("[MQTT] SSL: ");
    Serial.println(enableSSL ? "enabled" : "disabled");
    Serial.print("[MQTT] SNI: ");
    Serial.println(enableSNI ? "enabled" : "disabled");

    // Initialize modem MQTT (like POC: modem.mqtt_begin(enableSSL, enableSNI))
    modem->mqtt_begin(enableSSL, enableSNI);

    // Set root CA certificate if provided
    if (rootCA != nullptr && strlen(rootCA) > 0) {
        Serial.println("[MQTT] Setting root CA certificate...");
        modem->mqtt_set_certificate(rootCA);
    }

    Serial.println("[MQTT] Modem MQTT initialized");
    return true;
}

void MqttManager::begin() {
    if (modem == nullptr) {
        Serial.println("[MQTT] ERROR: Modem not initialized. Call setPppManager() first!");
        return;
    }
    useCustomSettings = false;
}

void MqttManager::begin(const char* host, uint16_t port, const char* username, const char* password) {
    if (modem == nullptr) {
        Serial.println("[MQTT] ERROR: Modem not initialized. Call setPppManager() first!");
        return;
    }

    customHost = host;
    customPort = port;
    customUsername = username;
    customPassword = password;
    useCustomSettings = true;
}

bool MqttManager::connect() {
    unsigned long now = millis();

    // If already connected, check connection health
    if (connected && modem != nullptr && modem->mqtt_connected()) {
        return true;
    }

    // Check if we should wait (backoff)
    if (lastConnectAttempt > 0 && (now - lastConnectAttempt) < backoff.getNextDelay()) {
        return false;
    }

    // Attempt connection
    lastConnectAttempt = now;

    if (modem == nullptr) {
        Serial.println("[MQTT] ERROR: Modem not available");
        incrementFailStreak();
        backoff.increment();
        return false;
    }

    const char* host = useCustomSettings ? customHost : MQTT_HOST;
    uint16_t port = useCustomSettings ? customPort : MQTT_PORT;
    const char* username = useCustomSettings ? customUsername : MQTT_USERNAME;
    const char* password = useCustomSettings ? customPassword : MQTT_PASSWORD;

    Serial.print("[MQTT] Connecting to broker ");
    Serial.print(host);
    Serial.print(":");
    Serial.print(port);
    Serial.println("...");

    String clientId = String("pgr_device_") + String(DEVICE_ID) + String("_") + String(random(0xffff), HEX);

    // Use modem's built-in MQTT client (handles DNS and TLS internally)
    // Like POC: modem.mqtt_connect(mqtt_client_id, broker, broker_port, client_id, username, password)
    bool success = modem->mqtt_connect(mqttClientId, host, port, clientId.c_str(), username, password);

    if (success && modem->mqtt_connected()) {
        Serial.println("[MQTT] Connected to broker");

        // Set callback for incoming messages
        modem->mqtt_set_callback(staticMqttCallback);

        // Subscribe to command topic
        if (modem->mqtt_subscribe(mqttClientId, MQTT_CMD_TOPIC)) {
            Serial.print("[MQTT] Subscribed to ");
            Serial.println(MQTT_CMD_TOPIC);
        } else {
            Serial.println("[MQTT] Failed to subscribe to command topic");
            modem->mqtt_disconnect();
            incrementFailStreak();
            backoff.increment();
            return false;
        }

        connected = true;
        resetMqttFailStreak();
        backoff.reset();
        return true;
    } else {
        Serial.println("[MQTT] Connection failed");
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
    if (connected && modem != nullptr) {
        Serial.println("[MQTT] Disconnecting...");
        modem->mqtt_disconnect();
        connected = false;
    }
}

bool MqttManager::isConnected() const {
    if (modem != nullptr) {
        return modem->mqtt_connected();
    }
    return connected;
}

bool MqttManager::publish(const char* topic, const char* payload, bool retained) {
    if (!isConnected() || modem == nullptr) {
        Serial.println("[MQTT] Cannot publish: not connected");
        return false;
    }

    // Use modem's MQTT publish (like POC: modem.mqtt_publish(mqtt_client_id, topic, payload))
    bool result = modem->mqtt_publish(mqttClientId, topic, payload);
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
    if (!connected || modem == nullptr) {
        return;
    }

    // Process MQTT messages (like POC: modem.mqtt_handle())
    modem->mqtt_handle();

    // Check connection status
    if (!modem->mqtt_connected()) {
        Serial.println("[MQTT] Connection lost");
        connected = false;
        incrementFailStreak();
    }
}

// Modem MQTT callback (signature: const char* topic, const uint8_t* payload, uint32_t len)
void MqttManager::staticMqttCallback(const char* topic, const uint8_t* payload, uint32_t len) {
    if (instance == nullptr) {
        return;
    }

    // Create null-terminated string from payload
    char message[len + 1];
    memcpy(message, payload, len);
    message[len] = '\0';

    Serial.print("[MQTT] Message received on topic: ");
    Serial.print(topic);
    Serial.print(", payload: ");
    Serial.println(message);

    if (instance->commandCallback != nullptr) {
        instance->commandCallback(topic, message);
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

