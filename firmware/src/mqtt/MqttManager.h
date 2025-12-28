#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <Arduino.h>
#include <stdint.h>
#include <PubSubClient.h>
#include <Client.h>
#include "config/config.h"
#include "util/Backoff.h"

/**
 * MQTT client manager with automatic reconnection and failure tracking.
 */
class MqttManager {
public:
    MqttManager();

    /**
     * Initialize MQTT client (call once in setup).
     */
    void begin();

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
    Client* networkClient;
    PubSubClient mqttClient;
    Backoff backoff;
    bool connected;
    uint8_t mqttFailStreak;
    unsigned long lastConnectAttempt;
    unsigned long lastStatusPublish;
    void (*commandCallback)(const char* topic, const char* payload);

    void onMessage(char* topic, uint8_t* payload, unsigned int length);
    static void staticOnMessage(char* topic, uint8_t* payload, unsigned int length);
    static MqttManager* instance;
};

#endif // MQTT_MANAGER_H

