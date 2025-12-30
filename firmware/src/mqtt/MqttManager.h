#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <Arduino.h>
#include <stdint.h>
#include "config/config.h"
#include "util/Backoff.h"
#include "tinygsm_pre.h"  // Must be before TinyGSM includes
#include <TinyGsm.h>  // For TinyGsm type

// Forward declaration
class PppManager;

/**
 * MQTT client manager with automatic reconnection and failure tracking.
 */
class MqttManager {
public:
    MqttManager();

    /**
     * Initialize MQTT client (call once in setup).
     * Uses default values from config.h
     */
    void begin();

    /**
     * Initialize MQTT client with custom server settings.
     * Call this instead of begin() to override config.h values.
     */
    void begin(const char* host, uint16_t port, const char* username = nullptr, const char* password = nullptr);

    /**
     * Set PppManager to get TinyGsm modem for MQTT connectivity.
     * The modem's built-in MQTT client will be used (supports TLS/SSL).
     */
    void setPppManager(PppManager* pppManager);

    /**
     * Initialize modem MQTT with SSL/TLS (call after PPP is up).
     * Must be called before connect() for TLS connections.
     */
    bool initializeModemMqtt(bool enableSSL = true, bool enableSNI = true, const char* rootCA = nullptr);

    /**
     * Connect to MQTT broker.
     * Returns true if connected, false otherwise.
     * Non-blocking, call repeatedly until returns true.
     */
    bool connect();

    /**
     * Disconnect from MQTT broker.
     */
    void disconnect();

    /**
     * Check if MQTT is currently connected.
     */
    bool isConnected() const;

    /**
     * Publish message to a topic.
     * Returns true if published successfully.
     */
    bool publish(const char* topic, const char* payload, bool retained = false);

    /**
     * Publish ACK message.
     */
    void publishAck(const char* requestId, bool ok, const char* errorCode = nullptr);

    /**
     * Publish status message.
     */
    void publishStatus();

    /**
     * Set callback for incoming command messages.
     */
    void setCommandCallback(void (*callback)(const char* topic, const char* payload));

    /**
     * Call this in loop() to process MQTT messages.
     * For modem MQTT, this calls modem.mqtt_handle().
     */
    void loop();

    /**
     * Get current MQTT failure streak.
     */
    uint8_t getMqttFailStreak() const;

    /**
     * Reset MQTT failure streak.
     */
    void resetMqttFailStreak();

    /**
     * Increment failure streak (called on failure).
     */
    void incrementFailStreak();

    /**
     * Check if PPP rebuild is needed based on failure streak.
     */
    bool shouldRebuildPpp() const;

    /**
     * Get backoff instance for reconnection delays.
     */
    Backoff& getBackoff();

private:
    Backoff backoff;
    bool connected;
    uint8_t mqttFailStreak;
    unsigned long lastConnectAttempt;
    unsigned long lastStatusPublish;
    void (*commandCallback)(const char* topic, const char* payload);

    // PppManager reference (for getting TinyGsm modem)
    PppManager* pppManager;
    TinyGsm* modem;  // Direct access to modem for MQTT API

    // Custom MQTT settings (if set via begin(host, port, ...))
    const char* customHost;
    uint16_t customPort;
    const char* customUsername;
    const char* customPassword;
    bool useCustomSettings;

    // Modem MQTT client ID (0 or 1)
    uint8_t mqttClientId;

    // Modem MQTT callback wrapper
    static void staticMqttCallback(const char* topic, const uint8_t* payload, uint32_t len);
    static MqttManager* instance;
};

#endif // MQTT_MANAGER_H

