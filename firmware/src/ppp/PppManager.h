#ifndef PPP_MANAGER_H
#define PPP_MANAGER_H

#include <Arduino.h>
#include <stdint.h>
#include <HardwareSerial.h>
#include "config/config.h"
#include "modem/ModemManager.h"

// ESP32 PPP over Serial (PPPoS)
// Note: For skeleton, we use a simplified approach
// Full implementation would use esp_netif_ppp.h and lwIP PPP API

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

private:
    ModemManager* modemManager;
    bool pppUp;
    uint8_t pppFailStreak;
    unsigned long pppStartTime;
    bool pppStarting;

    bool checkIpAssigned();
    bool sendPppAtCommands();
};

#endif // PPP_MANAGER_H

