#ifndef GATE_CONTROL_H
#define GATE_CONTROL_H

#include <Arduino.h>
#include <stdint.h>
#include "config/config.h"

/**
 * Gate control module with cooldown and dedupe mechanisms.
 * Prevents rapid-fire gate openings and handles duplicate requests.
 */
class GateControl {
public:
    /**
     * Initialize gate control state.
     */
    static void init();

    /**
     * Check if gate can be opened now (cooldown check).
     *
     * @param nowMs Current time in milliseconds (from millis())
     * @param remainingMs Output parameter: remaining cooldown time in ms (0 if can execute)
     * @return true if gate can be opened now, false if in cooldown
     */
    static bool canExecuteNow(uint32_t nowMs, uint32_t& remainingMs);

    /**
     * Record that gate was opened at the given time.
     * Updates lastOpenAtMs for cooldown tracking.
     *
     * @param nowMs Current time in milliseconds
     */
    static void recordOpen(uint32_t nowMs);

    /**
     * Check if a requestId was already processed (dedupe check).
     *
     * @param requestId Request ID string to check
     * @return true if requestId was already processed, false otherwise
     */
    static bool wasProcessed(const char* requestId);

    /**
     * Mark a requestId as processed (add to dedupe cache).
     *
     * @param requestId Request ID string to mark as processed
     */
    static void markProcessed(const char* requestId);

private:
    static uint32_t lastOpenAtMs;
    static char dedupeCache[DEDUP_CACHE_SIZE][37];  // 37 bytes per UUID (36 + null terminator)
    static uint8_t dedupeCacheIndex;
    static uint8_t dedupeCacheCount;
};

#endif // GATE_CONTROL_H

