#ifndef MODEM_MANAGER_H
#define MODEM_MANAGER_H

#include <Arduino.h>
#include <stdint.h>
#include <HardwareSerial.h>
#include "config/config.h"

/**
 * Manages A7670G cellular modem initialization, power control, and AT commands.
 */
class ModemManager {
public:
    ModemManager();

    /**
     * Initialize modem: power on, AT handshake, configure.
     * Non-blocking, call repeatedly until returns true.
     * Returns true when modem is ready.
     */
    bool init();

    /**
     * Power cycle the modem (power off, then on).
     */
    void powerCycle();

    /**
     * Hard reset the modem (reset pin).
     */
    void hardReset();

    /**
     * Check if modem is ready (AT handshake successful).
     */
    bool isReady() const;

    /**
     * Get the UART serial interface for PPP.
     */
    HardwareSerial* getSerial();

    /**
     * Send AT command to modem (public interface for PPP configuration).
     * Returns true if command succeeds (receives expected response).
     */
    bool sendATCommand(const char* cmd, const char* expectedResponse, unsigned long timeoutMs);

    /**
     * Send AT command and return the full response string.
     * Useful for commands that return data (like DNS resolution).
     */
    String sendATCommandGetResponse(const char* cmd, const char* expectedResponse, unsigned long timeoutMs);

private:
    HardwareSerial modemSerial;
    bool ready;
    unsigned long initStartTime;
    enum InitState {
        INIT_POWER_ON,
        INIT_WAIT_POWER,
        INIT_AT_HANDSHAKE,
        INIT_DISABLE_ECHO,
        INIT_QUERY_SIM,
        INIT_QUERY_NETWORK,
        INIT_QUERY_RSSI,
        INIT_COMPLETE
    };
    InitState initState;

    bool waitForResponse(const char* expectedResponse, unsigned long timeoutMs);
    void powerOn();
    void powerOff();
    void resetPin();
    void flushSerial();
};

#endif // MODEM_MANAGER_H

