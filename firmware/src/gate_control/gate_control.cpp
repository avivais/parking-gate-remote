#include "gate_control.h"
#include <string.h>

uint32_t GateControl::lastOpenAtMs = 0;
char GateControl::dedupeCache[DEDUP_CACHE_SIZE][37] = {0};
uint8_t GateControl::dedupeCacheIndex = 0;
uint8_t GateControl::dedupeCacheCount = 0;

void GateControl::init() {
    lastOpenAtMs = 0;
    dedupeCacheIndex = 0;
    dedupeCacheCount = 0;

    // Clear dedupe cache
    for (uint8_t i = 0; i < DEDUP_CACHE_SIZE; i++) {
        dedupeCache[i][0] = '\0';
    }

    Serial.println("[GateControl] Initialized (cooldown and dedupe ready)");
}

bool GateControl::canExecuteNow(uint32_t nowMs, uint32_t& remainingMs) {
    if (lastOpenAtMs == 0) {
        // Never opened before, can execute
        remainingMs = 0;
        return true;
    }

    uint32_t elapsed = nowMs - lastOpenAtMs;

    if (elapsed >= GATE_COOLDOWN_MS) {
        // Cooldown expired
        remainingMs = 0;
        return true;
    }

    // Still in cooldown
    remainingMs = GATE_COOLDOWN_MS - elapsed;
    return false;
}

void GateControl::recordOpen(uint32_t nowMs) {
    lastOpenAtMs = nowMs;
    Serial.print("[GateControl] Recorded gate open at ");
    Serial.print(nowMs);
    Serial.print("ms (cooldown: ");
    Serial.print(GATE_COOLDOWN_MS);
    Serial.println("ms)");
}

bool GateControl::wasProcessed(const char* requestId) {
    if (requestId == nullptr || requestId[0] == '\0') {
        return false;
    }

    // Check all entries in cache
    uint8_t entriesToCheck = (dedupeCacheCount < DEDUP_CACHE_SIZE) ? dedupeCacheCount : DEDUP_CACHE_SIZE;

    for (uint8_t i = 0; i < entriesToCheck; i++) {
        if (strcmp(dedupeCache[i], requestId) == 0) {
            Serial.print("[GateControl] Dedupe hit: requestId ");
            Serial.print(requestId);
            Serial.println(" already processed");
            return true;
        }
    }

    return false;
}

void GateControl::markProcessed(const char* requestId) {
    if (requestId == nullptr || requestId[0] == '\0') {
        return;
    }

    // Copy requestId to cache (circular buffer)
    strncpy(dedupeCache[dedupeCacheIndex], requestId, 36);
    dedupeCache[dedupeCacheIndex][36] = '\0';  // Ensure null termination

    Serial.print("[GateControl] Marked requestId ");
    Serial.print(requestId);
    Serial.print(" as processed (cache index ");
    Serial.print(dedupeCacheIndex);
    Serial.println(")");

    // Advance circular buffer index
    dedupeCacheIndex = (dedupeCacheIndex + 1) % DEDUP_CACHE_SIZE;

    // Track how many entries we have (until cache is full)
    if (dedupeCacheCount < DEDUP_CACHE_SIZE) {
        dedupeCacheCount++;
    }
}

