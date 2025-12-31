# MCU Gate Open Test Procedures

This document describes manual testing procedures for the gate actuator functionality with reliability guardrails.

## Prerequisites

1. Device is flashed with firmware and connected to serial monitor (115200 baud)
2. MQTT broker (HiveMQ Cloud) is accessible
3. Device has established PPP connection and MQTT connection
4. `mosquitto_pub` and `mosquitto_sub` tools available (or equivalent MQTT client)

## Test Topics

- Command topic: `pgr/mitspe6/gate/cmd`
- ACK topic: `pgr/mitspe6/gate/ack`
- Status topic: `pgr/mitspe6/gate/status`

## Test 1: Verify Command Reception

**Objective**: Verify device receives commands on the cmd topic.

**Steps**:
1. Subscribe to command topic:
   ```bash
   mosquitto_sub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" -v
   ```

2. Monitor serial output - device should log when commands are received

**Expected Result**: Commands published to the topic should appear in the subscription and be logged in serial output.

## Test 2: Verify ACK Publishing

**Objective**: Verify device publishes ACK messages after processing commands.

**Steps**:
1. Subscribe to ACK topic:
   ```bash
   mosquitto_sub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/ack" -v
   ```

2. Publish a test command (see Test 3 for command format)

**Expected Result**: ACK message should appear on the ack topic with JSON format:
```json
{"requestId":"<uuid>","ok":true}
```
or
```json
{"requestId":"<uuid>","ok":false,"errorCode":"<CODE>"}
```

## Test 3: Test Dedupe (Idempotency)

**Objective**: Verify duplicate requestIds are handled idempotently (relay activates only once, but both ACKs are ok=true).

**Steps**:
1. Subscribe to ACK topic (as in Test 2)
2. Generate a UUID for requestId (e.g., `550e8400-e29b-41d4-a716-446655440000`)
3. Publish the same command twice with the same requestId:
   ```bash
   # First publish
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m '{"requestId":"550e8400-e29b-41d4-a716-446655440000","command":"open","userId":"test-user","issuedAt":1234567890}'

   # Wait 1 second, then publish again with same requestId
   sleep 1
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m '{"requestId":"550e8400-e29b-41d4-a716-446655440000","command":"open","userId":"test-user","issuedAt":1234567890}'
   ```

4. Monitor serial output for dedupe log messages

**Expected Result**:
- First command: Relay activates (3s pulse), ACK with `ok:true`
- Second command: No relay activation (dedupe hit), ACK with `ok:true` (idempotent)
- Serial logs show "Dedupe hit" message for second command

## Test 4: Test Cooldown

**Objective**: Verify cooldown prevents rapid gate openings (default 8 seconds).

**Steps**:
1. Subscribe to ACK topic (as in Test 2)
2. Publish first command with unique requestId:
   ```bash
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m '{"requestId":"11111111-1111-1111-1111-111111111111","command":"open","userId":"test-user","issuedAt":1234567890}'
   ```

3. Immediately (within 8 seconds) publish second command with different requestId:
   ```bash
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m '{"requestId":"22222222-2222-2222-2222-222222222222","command":"open","userId":"test-user","issuedAt":1234567890}'
   ```

4. Monitor serial output for cooldown log messages

**Expected Result**:
- First command: Relay activates, ACK with `ok:true`
- Second command: No relay activation, ACK with `ok:false, errorCode:"COOLDOWN"`
- Serial logs show cooldown message with remaining time

## Test 5: Test Status Publishing (Healthcheck)

**Objective**: Verify device publishes periodic status messages for healthcheck.

**Steps**:
1. Subscribe to status topic:
   ```bash
   mosquitto_sub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/status" -v
   ```

2. Wait and observe messages

**Expected Result**:
- Status messages appear approximately every 5 seconds
- JSON format:
  ```json
  {"deviceId":"mitspe6-gate-001","online":true,"updatedAt":<timestamp>,"fwVersion":"fw-dev-0.1"}
  ```
- Serial logs show status publication messages

## Test 6: Test Invalid Commands

**Objective**: Verify error handling for invalid payloads and unknown commands.

**Steps**:
1. Subscribe to ACK topic (as in Test 2)
2. Test invalid JSON:
   ```bash
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m 'invalid json'
   ```

3. Test missing fields:
   ```bash
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m '{"requestId":"test-123"}'
   ```

4. Test unknown command:
   ```bash
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud -p 8883 \
     -u avivais -P Avivr_121 \
     -t "pgr/mitspe6/gate/cmd" \
     -m '{"requestId":"test-123","command":"close","userId":"test-user","issuedAt":1234567890}'
   ```

**Expected Result**:
- Invalid JSON: ACK with `ok:false, errorCode:"BAD_PAYLOAD"`
- Missing fields: ACK with `ok:false, errorCode:"BAD_PAYLOAD"`
- Unknown command: ACK with `ok:false, errorCode:"UNKNOWN_COMMAND"`
- No relay activation for any of these cases

## Test 7: Verify Relay Activation

**Objective**: Verify GPIO 18 relay actually activates (hardware test).

**Steps**:
1. Connect oscilloscope or LED to GPIO 18
2. Publish valid open command (as in Test 3)
3. Observe GPIO 18 signal

**Expected Result**:
- GPIO 18 goes HIGH for exactly 3000ms (3 seconds)
- GPIO 18 returns to LOW after pulse
- Serial logs show relay activation start and completion

## Troubleshooting

### No ACK received
- Check MQTT connection status in serial logs
- Verify device is subscribed to cmd topic
- Check broker credentials and network connectivity

### Relay not activating
- Verify GPIO 18 is not being used by another component
- Check serial logs for error messages
- Verify relay hardware connections

### Status messages not appearing
- Check MQTT connection is established
- Verify STATUS_INTERVAL_MS is configured correctly
- Check serial logs for status publication errors

### Cooldown not working
- Verify GATE_COOLDOWN_MS is set correctly in config.h
- Check serial logs for cooldown calculations
- Ensure system time (millis()) is functioning correctly

