# MQTT Protocol Specification

This document serves as the single source of truth for the MQTT contract between the NestJS backend (publisher of commands) and the MCU device (subscriber/ack publisher) in the Parking Gate Remote system.

## Overview

The protocol uses three MQTT topics for bidirectional communication:
- **Backend → MCU**: Commands are published to the command topic
- **MCU → Backend**: Acknowledgments and status updates are published to their respective topics

## Topics

### `pgr/mitspe6/gate/cmd`
- **Direction**: Backend → MCU
- **Publisher**: NestJS backend
- **Subscriber**: MCU device
- **Purpose**: Command messages to control the gate

### `pgr/mitspe6/gate/ack`
- **Direction**: MCU → Backend
- **Publisher**: MCU device
- **Subscriber**: NestJS backend
- **Purpose**: Acknowledgment messages in response to commands

### `pgr/mitspe6/gate/status`
- **Direction**: MCU → Backend
- **Publisher**: MCU device
- **Subscriber**: NestJS backend
- **Purpose**: Status updates from the MCU (currently logged at debug level only)

## Message Schemas

### Command Message (`pgr/mitspe6/gate/cmd`)

Published by the backend when a gate operation is requested.

**Schema:**
```json
{
  "requestId": "string (UUID, required)",
  "command": "string (required, currently only 'open')",
  "userId": "string (required)",
  "issuedAt": "number (Unix timestamp in milliseconds, required)"
}
```

**Example:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "command": "open",
  "userId": "user-123",
  "issuedAt": 1704067200000
}
```

**MQTT Settings:**
- **QoS**: 1 (at least once delivery)
- **Retain**: false (messages are not retained)

**Field Descriptions:**
- `requestId`: Unique identifier for the request (UUID format). Used for matching commands with acknowledgments.
- `command`: The command to execute. Currently only `"open"` is supported.
- `userId`: Identifier of the user requesting the gate operation.
- `issuedAt`: Unix timestamp in milliseconds when the command was issued by the backend. Used for debugging and time correlation.

### ACK Message (`pgr/mitspe6/gate/ack`)

Published by the MCU in response to a command message.

**Schema:**
```json
{
  "requestId": "string (UUID, required)",
  "ok": "boolean (required)",
  "errorCode": "string (optional, present when ok: false)"
}
```

**Success Example:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "ok": true
}
```

**Error Example:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "ok": false,
  "errorCode": "GATE_STUCK"
}
```

**MQTT Settings:**
- **QoS**: 1 (at least once delivery)

**Field Descriptions:**
- `requestId`: Must match the `requestId` from the corresponding command message.
- `ok`: `true` if the command was executed successfully, `false` otherwise.
- `errorCode`: Optional error code string. Only present when `ok` is `false`. Can be used to provide specific error information.

### Status Message (`pgr/mitspe6/gate/status`)

Published by the MCU for status updates. Currently, the backend only logs these messages at debug level and does not process them.

**Schema:**
```json
{
  "deviceId": "string (required)",
  "online": "boolean (required)",
  "updatedAt": "number (Unix timestamp in milliseconds, required)",
  "rssi": "number (optional, signal strength in dBm)",
  "fwVersion": "string (optional, firmware version)"
}
```

**Example:**
```json
{
  "deviceId": "mitspe6-gate-001",
  "online": true,
  "updatedAt": 1704067200000,
  "rssi": -65,
  "fwVersion": "1.2.3"
}
```

**MQTT Settings:**
- **QoS**: 1 (at least once delivery)

## Timing Rules

### Backend Timeout

- **Configuration**: `MCU_TIMEOUT_MS` environment variable
- **Default**: 5000ms (5 seconds)
- **Behavior**: If no ACK is received within the timeout period, the backend throws a `GatewayTimeoutException` and does not retry the command.

### Retry Logic

- **Retry Count**: `MCU_RETRY_COUNT` environment variable (default: 1)
  - This means the backend will attempt the command up to `MCU_RETRY_COUNT + 1` times total (initial attempt + retries).
- **Retry Delay**: `MCU_RETRY_DELAY_MS` environment variable (default: 250ms in code, recommended 500ms for cellular networks)
  - Delay between retry attempts.
- **Retry Conditions**:
  - Retries are only attempted for non-timeout errors (e.g., connection failures, publish errors).
  - Timeout errors do not trigger retries; they fail immediately.

### Late ACK Handling

- **Behavior**: ACKs received for unknown `requestId` values (i.e., after timeout or for requests that were never sent) are ignored.
- **Logging**: Late ACKs are logged at DEBUG level: `"Received ACK for unknown requestId: <requestId>"`.

## Idempotency and Duplicate Handling

### Duplicate ACKs

- **Behavior**: If the backend receives multiple ACKs with the same `requestId`:
  - The first ACK is processed normally.
  - Subsequent ACKs for the same `requestId` are ignored (the `requestId` is removed from pending requests after the first ACK).
  - If an ACK arrives for a `requestId` that is not in the pending requests map, it is logged at DEBUG level and ignored.

### Repeated Commands with Same requestId

- **Safety**: It is safe to publish multiple command messages with the same `requestId`.
- **Backend Behavior**: The backend tracks pending requests by `requestId` in a Map. If a command with the same `requestId` is published while a previous one is still pending, the new command will overwrite the pending request entry.
- **Replay Protection**: Replay protection is handled at the API level via the `GateRequest` MongoDB schema (`backend/src/gate/schemas/gate-request.schema.ts`), which enforces a unique `requestId` constraint with a TTL index. This prevents duplicate `requestId` values from being processed through the API endpoint.

## Implementation Checklists

### Backend Implementation Checklist

- [ ] Connect to MQTT broker on module initialization
- [ ] Subscribe to `pgr/mitspe6/gate/ack` topic with QoS 1
- [ ] Subscribe to `pgr/mitspe6/gate/status` topic with QoS 1
- [ ] Implement command publishing:
  - [ ] Publish to `pgr/mitspe6/gate/cmd` with QoS 1, retain: false
  - [ ] Include `requestId`, `command`, `userId`, and `issuedAt` in message payload
- [ ] Implement ACK handling:
  - [ ] Parse incoming ACK messages
  - [ ] Match ACK `requestId` with pending requests
  - [ ] Resolve pending promise on success (`ok: true`)
  - [ ] Reject pending promise on error (`ok: false`)
  - [ ] Ignore ACKs for unknown `requestId` (log at DEBUG level)
- [ ] Implement timeout handling:
  - [ ] Set timeout timer when publishing command
  - [ ] Reject with `GatewayTimeoutException` if no ACK received within `MCU_TIMEOUT_MS`
  - [ ] Clear timeout on ACK receipt
- [ ] Implement retry logic:
  - [ ] Retry up to `MCU_RETRY_COUNT` times for non-timeout errors
  - [ ] Wait `MCU_RETRY_DELAY_MS` between retries
  - [ ] Do not retry on timeout errors
- [ ] Handle duplicate ACKs:
  - [ ] Remove `requestId` from pending requests after first ACK
  - [ ] Ignore subsequent ACKs for same `requestId`
- [ ] Handle connection errors gracefully:
  - [ ] Attempt reconnection on disconnect
  - [ ] Return appropriate error responses when broker is unavailable

### MCU Implementation Checklist

- [ ] Connect to MQTT broker with device credentials
- [ ] Subscribe to `pgr/mitspe6/gate/cmd` topic with QoS 1
- [ ] Implement command processing:
  - [ ] Parse incoming command messages
  - [ ] Validate `requestId`, `command`, `userId`, and `issuedAt` fields
  - [ ] Execute the gate operation (e.g., open gate)
- [ ] Implement ACK publishing:
  - [ ] Publish ACK to `pgr/mitspe6/gate/ack` with QoS 1
  - [ ] Include matching `requestId` from command
  - [ ] Set `ok: true` on success, `ok: false` on error
  - [ ] Include optional `errorCode` when `ok: false`
  - [ ] Publish ACK promptly after processing command
- [ ] Handle duplicate commands:
  - [ ] Commands with the same `requestId` should be idempotent
  - [ ] Consider tracking processed `requestId` values to avoid duplicate operations
- [ ] (Optional) Implement status publishing:
  - [ ] Publish status updates to `pgr/mitspe6/gate/status` with QoS 1
  - [ ] Include `deviceId`, `online`, `updatedAt` (required fields)
  - [ ] Optionally include `rssi` and `fwVersion` (optional fields)

## Current Implementation vs Planned Improvements

### Current Implementation

- Command messages include `issuedAt` timestamp for debugging/time correlation
- Status messages are logged at DEBUG level but not processed
- Late ACKs are logged at DEBUG level and ignored
- Replay protection via MongoDB `GateRequest` schema at API level
- Default retry delay is 250ms (code default)

### Planned Improvements

- Status message processing and storage (currently only logged)
- Enhanced error handling and retry strategies
- Metrics and monitoring for MQTT message flow
