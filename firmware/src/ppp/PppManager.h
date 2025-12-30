#ifndef PPP_MANAGER_H
#define PPP_MANAGER_H

// CRITICAL: Include TinyGSM pre-header FIRST (before any other includes)
// This ensures TINY_GSM_MODEM_A7670 is defined before TinyGsm.h includes TinyGsmClient.h
#include "tinygsm_pre.h"

#include <Arduino.h>
#include <stdint.h>
#include <HardwareSerial.h>
#include "config/config.h"
#include "modem/ModemManager.h"

// Include utilities.h for board pin definitions
#include "utilities.h"

// Now include TinyGSM headers (TINY_GSM_MODEM_A7670 is now defined via tinygsm_pre.h)
#include <TinyGsm.h>
#include <TinyGsmClient.h>

/**
 * Manages PPP connection over UART to cellular modem.
 * Tracks failure streak and triggers modem hard reset when threshold exceeded.
 */
class PppManager {
public:
    PppManager(ModemManager* modemManager);

    /**
     * Start PPP session.
     * Returns true if started (non-blocking).
     */
    bool start();

    /**
     * Stop PPP session cleanly.
     */
    void stop();

    /**
     * Wait for PPP to come up (IP assigned).
     * Returns true if PPP is up within timeout.
     */
    bool waitForPppUp(unsigned long timeoutMs);

    /**
     * Check if PPP is currently up.
     */
    bool isUp() const;

    /**
     * Get current PPP failure streak.
     */
    uint8_t getPppFailStreak() const;

    /**
     * Reset PPP failure streak.
     */
    void resetPppFailStreak();

    /**
     * Increment failure streak (called on failure).
     */
    void incrementFailStreak();

    /**
     * Check if hard reset is needed based on failure streak.
     */
    bool shouldHardReset() const;

    /**
     * Get TinyGSM modem instance (for use by MqttManager).
     */
    TinyGsm* getModem();

    /**
     * Get TinyGsmClient instance (for use by MqttManager).
     */
    TinyGsmClient* getClient();

    /**
     * Get ModemManager instance (for DNS resolution via AT commands).
     */
    ModemManager* getModemManager();

    /**
     * Initialize modem's built-in MQTT client with SSL/TLS.
     * Call this before using modem.mqtt_* methods.
     */
    bool initializeModemMqtt(bool enableSSL, bool enableSNI, const char* rootCA = nullptr);

private:
    ModemManager* modemManager;
    bool pppUp;
    uint8_t pppFailStreak;
    unsigned long pppStartTime;
    bool pppStarting;

    // TinyGSM instances
    TinyGsm* tinyGsmModem;
    TinyGsmClient* tinyGsmClient;
    HardwareSerial* modemSerial;

    bool checkIpAssigned();
    bool initializeTinyGsm();
    void deinitializeTinyGsm();
};

#endif // PPP_MANAGER_H

