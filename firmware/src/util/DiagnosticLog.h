#ifndef DIAGNOSTIC_LOG_H
#define DIAGNOSTIC_LOG_H

#include <Arduino.h>
#include <stdint.h>
#include <stddef.h>
#include "config/config.h"

#if DIAGNOSTIC_LOG_ENABLED

// Event level for diagnostic entries
enum class DiagnosticLevel : uint8_t {
    Info = 0,
    Warn = 1,
    Error = 2
};

// Fixed-size entry for NVS ring buffer (keep small to fit many entries)
#define DIAG_EVENT_LEN 20
#define DIAG_MESSAGE_LEN 32

struct DiagnosticEntry {
    uint32_t ts;
    uint8_t level;
    char event[DIAG_EVENT_LEN];
    char message[DIAG_MESSAGE_LEN];
};

/**
 * Persistent diagnostic log for recovery events. Stored in NVS so entries
 * survive reboot. After reconnect, upload to backend then clear.
 */
class DiagnosticLog {
public:
    DiagnosticLog();

    /** Append an entry (ring buffer, overwrites oldest when full). */
    void append(DiagnosticLevel level, const char* event, const char* message = nullptr);

    /** Number of entries currently stored. */
    size_t getEntryCount() const;

    /** Copy entry at index into provided buffers. Returns false if index out of range. */
    bool getEntry(size_t index, uint32_t* outTs, uint8_t* outLevel,
                  char* outEvent, size_t eventLen,
                  char* outMessage, size_t messageLen) const;

    /** Remove all entries (call after successful upload). */
    void clear();

    /** Remove the first n entries (e.g. after uploading a batch). */
    void removeFirst(size_t n);

    /** True if there is at least one entry to upload. */
    bool hasEntries() const;

private:
    void load();
    void save();

    static const char* NVS_NAMESPACE;
    static const char* NVS_KEY_COUNT;
    static const char* NVS_KEY_DATA;

    uint8_t count_;
    DiagnosticEntry entries_[DIAGNOSTIC_LOG_MAX_ENTRIES];
    uint8_t head_;  // next write position (ring buffer)
};

#endif // DIAGNOSTIC_LOG_ENABLED

#endif // DIAGNOSTIC_LOG_H
