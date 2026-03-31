---
name: diagnostics
description: Fetch and interpret MCU diagnostic logs (pgr/mitspe6/gate/diagnostics) from the production API or Mongo fallback. Use when the MCU is offline, after an incident, or when asked “what went wrong?”.
---

# MCU Diagnostics Triage (Parking Gate Remote)

Use this skill to answer: **why did the MCU disconnect / what happened before it came back**.

## What exists today (data path)

- Firmware buffers recovery events in RAM and publishes them **after MQTT reconnect** to `pgr/mitspe6/gate/diagnostics`.
- Backend persists these batches to Mongo as `DeviceDiagnosticLog`.
- Admin endpoint exposes the persisted history.

Important limitation: if the MCU never reconnects to MQTT (or it reboots before upload), there may be **no diagnostics** stored.

## Prerequisites

- **API base**: `https://api.mitzpe6-8.com`
- **Device id**: e.g. `mitspe6-gate-001`
- **Admin JWT**: provide one of:
  - Environment variable `PGR_ADMIN_TOKEN`
  - Paste a token string when asked

## Primary method: API fetch (recommended)

1. Export your token (if available):

```bash
export PGR_ADMIN_TOKEN="...admin jwt..."
```

2. Fetch latest diagnostics for a device:

```bash
API_BASE="${API_BASE:-https://api.mitzpe6-8.com}"
DEVICE_ID="${DEVICE_ID:-mitspe6-gate-001}"
curl -sS "$API_BASE/api/gate/devices/$DEVICE_ID/diagnostics?limit=50&skip=0" \
  -H "Authorization: Bearer $PGR_ADMIN_TOKEN"
```

3. Interpret the response:

- Sort documents by `receivedAt` (already returned newest-first).
- For each document:
  - Note `receivedAt`, `fwVersion`, `sessionId` (if present).
  - Iterate `entries[]` in order and build a timeline: `(ts, level, event, message?)`.

## How to interpret common firmware events

These event names come from firmware recovery call-sites.

- **`connection_lost`**: MQTT connectivity dropped (or a publish failed and the client marked itself disconnected).
- **`connection_restored`**: MQTT connected again (and the MCU began uploading buffered diagnostics).
- **`ppp_rebuild`**: MCU escalated from “MQTT retry” to stopping PPP and rebuilding it.
- **`modem_reset`**: PPP failures escalated to a modem hard reset.
- **`init_retry`**: modem init timeout caused a power-cycle retry.
- **`backoff`**: modem init hit max retries and backed off before trying again.

## Output format (what to produce)

Return:

- **Summary**: 1–3 bullets of the most likely root cause (broker restart vs PPP instability vs modem init loops).
- **Timeline**: condensed ordered list of key events with timestamps.
- **Gaps**: explicitly call out if the logs are missing (no reconnect / buffer loss).
- **Next actions**: server-side checks (mosquitto/back-end logs) vs device-side actions (power, antenna, SIM, APN).

## Secondary method (fallback): query Mongo on EC2

If the API is down but EC2 is reachable, SSH to the server and query Mongo inside `parking-mongo`.

High-level approach:

```bash
ssh -i "$HOME/.ssh/VaisenKey.pem" ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com
docker exec -it parking-mongo mongosh
```

Then:
- `show dbs` / `use parking-gate` (or whatever DB name is configured)
- `show collections` and find the diagnostics collection (typically `devicediagnosticlogs`)
- Query by `deviceId` sorted by `receivedAt` descending.

Only use this when the API route is unavailable.

