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
- **Retain**: false

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
- **Retain**: false

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
- **Retain**: false

## Timing Rules

### Backend Timeout

- **Configuration**: `MCU_TIMEOUT_MS` environment variable
- **Code Default**: 5000ms (5 seconds)
- **Behavior**: If no ACK is received within the timeout period, the backend throws a `GatewayTimeoutException` and does not retry the command.

### Retry Logic

- **Retry Count**: `MCU_RETRY_COUNT` environment variable
  - **Code Default**: 1
  - Total attempts: `MCU_RETRY_COUNT + 1` (initial attempt + retries)
- **Retry Delay**: `MCU_RETRY_DELAY_MS` environment variable
  - **Code Default**: 250ms
  - **Recommended for Cellular Networks**: 500ms
  - Delay between retry attempts
- **Retry Conditions**:
  - **Retries occur for**:
    - Publish errors (MQTT publish callback error → `BadGatewayException`)
    - ACK `ok: false` (MCU error response → `BadGatewayException`)
    - Connection errors (MQTT broker connection failure → `BadGatewayException`)
  - **No retries for**:
    - Timeout (no ACK received within `MCU_TIMEOUT_MS` → `GatewayTimeoutException`, fails immediately)

### Late ACK Handling

- **Behavior**: ACKs received for unknown `requestId` values (i.e., after timeout or for requests that were never sent) are ignored.
- **Logging**: Late ACKs are logged at DEBUG level: `"Received ACK for unknown requestId: <requestId>"`.

## Idempotency and Duplicate Handling

### Duplicate ACKs

- **Behavior**: If the backend receives multiple ACKs with the same `requestId`:
  - The first ACK is processed normally.
  - Subsequent ACKs for the same `requestId` are ignored (the `requestId` is removed from pending requests after the first ACK).
  - If an ACK arrives for a `requestId` that is not in the pending requests map, it is logged at DEBUG level and ignored.

### RequestId Uniqueness and Idempotency

- **Backend Requirement**: The backend MUST generate a unique `requestId` (UUID) for each gate operation. The `GateRequest` MongoDB schema enforces uniqueness at the API level (`backend/src/gate/schemas/gate-request.schema.ts`).
- **MCU Requirement**: The MCU MUST be idempotent for duplicate delivery of the same `requestId`. MQTT QoS 1 guarantees at-least-once delivery, so the same command may be delivered multiple times. The MCU must handle this gracefully (e.g., ignore duplicate `requestId` values or ensure the operation is safe to repeat).
- **Backend Behavior**: The backend tracks pending requests by `requestId` in a Map. If a command with the same `requestId` is published while a previous one is still pending, the new command will overwrite the pending request entry.
- **Replay Protection**: Replay protection is handled at the API level via the `GateRequest` MongoDB schema, which enforces a unique `requestId` constraint with a TTL index (see TTL Window section below). This prevents duplicate `requestId` values from being processed through the API endpoint within the TTL window.

### GateRequest TTL Window

- **Default TTL**: 30 seconds
- **Configuration**: `GATE_REQUEST_TTL_SECONDS` environment variable (optional)
- **Implementation**: MongoDB TTL index on `createdAt` field (`backend/src/gate/schemas/gate-request.schema.ts` line 22, `backend/src/gate/gate.module.ts` lines 69-90)
- **Behavior**: After the TTL expires, the `requestId` is removed from the `GateRequest` collection, allowing the same `requestId` to be used again (for replay protection reset). The TTL index is dynamically updated on application startup based on the `GATE_REQUEST_TTL_SECONDS` configuration.

## Environment Variables

All MQTT and MCU configuration is controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GATE_DEVICE_MODE` | `stub` | Device communication mode: `stub` or `mqtt` |
| `MCU_TIMEOUT_MS` | `5000` | Timeout for MCU operations in milliseconds (code default) |
| `MCU_RETRY_COUNT` | `1` | Number of retry attempts (code default) |
| `MCU_RETRY_DELAY_MS` | `250` | Delay between retries in milliseconds (code default). Recommended: `500` for cellular networks |
| `MQTT_URL` | `mqtt://localhost:1883` | MQTT broker URL |
| `MQTT_USERNAME` | `pgr_server` | MQTT username for backend connection |
| `MQTT_PASSWORD` | *(none)* | MQTT password (must be set, no default) |
| `MQTT_CMD_TOPIC` | `pgr/mitspe6/gate/cmd` | Command topic (backend → MCU) |
| `MQTT_ACK_TOPIC` | `pgr/mitspe6/gate/ack` | Acknowledgment topic (MCU → backend) |
| `MQTT_STATUS_TOPIC` | `pgr/mitspe6/gate/status` | Status topic (MCU → backend) |
| `GATE_REQUEST_TTL_SECONDS` | `30` | TTL window for requestId replay protection in seconds (optional) |

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
