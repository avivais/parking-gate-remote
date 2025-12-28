#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <Arduino.h>

/**
 * Command parsing result structure.
 */
struct CommandResult {
    char requestId[37];      // UUID length (36 + null terminator)
    char command[16];
    char userId[64];
    unsigned long issuedAt;
    bool valid;

    CommandResult() : valid(false), issuedAt(0) {
        requestId[0] = '\0';
        command[0] = '\0';
        userId[0] = '\0';
    }
};

/**
 * Protocol handler for MQTT command parsing and ACK generation.
 */
class Protocol {
public:
    /**
     * Parse incoming command JSON message.
     * Returns true if parsing successful and all required fields present.
     */
    static bool parseCommand(const char* json, CommandResult& result);

    /**
     * Create ACK JSON message.
     * Output is written to output buffer (must be at least outputSize bytes).
     */
    static void createAck(const char* requestId, bool ok, const char* errorCode,
                         char* output, size_t outputSize);

    /**
     * Create status JSON message.
     * Output is written to output buffer (must be at least outputSize bytes).
     */
    static void createStatus(const char* deviceId, bool online, unsigned long updatedAt,
                           int rssi, const char* fwVersion, char* output, size_t outputSize);
};

#endif // PROTOCOL_H

