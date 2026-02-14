#include "DiagnosticLog.h"

#if DIAGNOSTIC_LOG_ENABLED

#include <Preferences.h>
#include <cstring>

const char* DiagnosticLog::NVS_NAMESPACE = "pgr_diag";
const char* DiagnosticLog::NVS_KEY_COUNT = "cnt";
const char* DiagnosticLog::NVS_KEY_DATA = "buf";

DiagnosticLog::DiagnosticLog()
    : count_(0), head_(0) {
    memset(entries_, 0, sizeof(entries_));
    load();
}

void DiagnosticLog::append(DiagnosticLevel level, const char* event, const char* message) {
    if (event == nullptr) return;

    DiagnosticEntry e;
    e.ts = millis();
    e.level = static_cast<uint8_t>(level);
    strncpy(e.event, event, DIAG_EVENT_LEN - 1);
    e.event[DIAG_EVENT_LEN - 1] = '\0';
    if (message != nullptr) {
        strncpy(e.message, message, DIAG_MESSAGE_LEN - 1);
        e.message[DIAG_MESSAGE_LEN - 1] = '\0';
    } else {
        e.message[0] = '\0';
    }

    entries_[head_] = e;
    head_ = (head_ + 1) % DIAGNOSTIC_LOG_MAX_ENTRIES;
    if (count_ < DIAGNOSTIC_LOG_MAX_ENTRIES) {
        count_++;
    }
    save();
}

size_t DiagnosticLog::getEntryCount() const {
    return count_;
}

bool DiagnosticLog::getEntry(size_t index, uint32_t* outTs, uint8_t* outLevel,
                             char* outEvent, size_t eventLen,
                             char* outMessage, size_t messageLen) const {
    if (index >= count_ || outTs == nullptr || outLevel == nullptr ||
        outEvent == nullptr || outMessage == nullptr) {
        return false;
    }
    // Oldest is at (head_ - count_ + DIAGNOSTIC_LOG_MAX_ENTRIES) % DIAGNOSTIC_LOG_MAX_ENTRIES
    size_t pos = (head_ + DIAGNOSTIC_LOG_MAX_ENTRIES - count_ + index) % DIAGNOSTIC_LOG_MAX_ENTRIES;
    const DiagnosticEntry& e = entries_[pos];
    *outTs = e.ts;
    *outLevel = e.level;
    strncpy(outEvent, e.event, eventLen - 1);
    outEvent[eventLen - 1] = '\0';
    strncpy(outMessage, e.message, messageLen - 1);
    outMessage[messageLen - 1] = '\0';
    return true;
}

void DiagnosticLog::clear() {
    count_ = 0;
    head_ = 0;
    memset(entries_, 0, sizeof(entries_));
    save();
}

void DiagnosticLog::removeFirst(size_t n) {
    if (n >= count_) {
        clear();
        return;
    }
    count_ -= n;
    save();
}

bool DiagnosticLog::hasEntries() const {
    return count_ > 0;
}

void DiagnosticLog::load() {
    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, true)) return;
    count_ = prefs.getUChar(NVS_KEY_COUNT, 0);
    if (count_ > DIAGNOSTIC_LOG_MAX_ENTRIES) count_ = DIAGNOSTIC_LOG_MAX_ENTRIES;
    if (count_ > 0) {
        DiagnosticEntry tmp[DIAGNOSTIC_LOG_MAX_ENTRIES];
        size_t len = count_ * sizeof(DiagnosticEntry);
        prefs.getBytes(NVS_KEY_DATA, tmp, len);
        for (size_t i = 0; i < count_; i++) {
            entries_[i] = tmp[i];
        }
    }
    prefs.end();
    head_ = count_;
}

void DiagnosticLog::save() {
    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, false)) return;
    prefs.putUChar(NVS_KEY_COUNT, count_);
    if (count_ > 0) {
        DiagnosticEntry tmp[DIAGNOSTIC_LOG_MAX_ENTRIES];
        for (size_t i = 0; i < count_; i++) {
            size_t pos = (head_ + DIAGNOSTIC_LOG_MAX_ENTRIES - count_ + i) % DIAGNOSTIC_LOG_MAX_ENTRIES;
            tmp[i] = entries_[pos];
        }
        prefs.putBytes(NVS_KEY_DATA, tmp, count_ * sizeof(DiagnosticEntry));
    }
    prefs.end();
}

#endif // DIAGNOSTIC_LOG_ENABLED
