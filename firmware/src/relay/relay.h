#ifndef RELAY_H
#define RELAY_H

#include <Arduino.h>
#include "config/config.h"

/**
 * Relay control module for gate actuator.
 * Controls GPIO pin for relay pulse activation.
 */
class Relay {
public:
    /**
     * Initialize relay GPIO pin.
     * Sets pin as OUTPUT and ensures it starts LOW (safe state).
     */
    static void init();

    /**
     * Activate relay pulse.
     * Sets pin HIGH for RELAY_PULSE_MS, then sets LOW.
     * This is a blocking operation.
     *
     * @return true if pulse completed successfully
     */
    static bool activatePulse();
};

#endif // RELAY_H

