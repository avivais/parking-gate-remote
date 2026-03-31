# OTA (Over-the-Air) Firmware Updates (Plan + Phase 1 Scaffolding)

This project does **not** ship full OTA by default yet, but it now includes:

- A **device-authenticated** OTA manifest endpoint: `GET /api/device/ota-manifest`
- A configuration knob to publish manifests via `OTA_MANIFEST_JSON` (backend env)

## Goals

- Update MCU firmware without site visits when the device has an IP path.
- Keep rollback easy (A/B partitions + boot validation + ability to re-flash previous binary).

## Phase 1 (implemented scaffolding)

### Backend: provide OTA manifest

- Endpoint: `GET /api/device/ota-manifest`
- Auth: `X-Device-Id` + `X-Device-Token` (same as `/api/device/pending-command`)
- Response shape:

```json
{ "deviceId": "mitspe6-gate-001", "ota": null }
```

or, if configured:

```json
{
  "deviceId": "mitspe6-gate-001",
  "ota": {
    "version": "fw-prod-1.0.1",
    "url": "https://example.com/firmware.bin",
    "sha256": "..."
  }
}
```

Configure in `backend/.env`:

```bash
OTA_MANIFEST_JSON={"mitspe6-gate-001":{"version":"fw-prod-1.0.1","url":"https://.../firmware.bin","sha256":"..."}}
```

### Firmware: not enabled yet

Firmware download + verify + apply is intentionally not enabled until we implement:

- A/B partitions
- Secure download + integrity verification (sha256)
- Rollback on failed boot

## Recommended full OTA design (Phase 2+)

- **Partitioning**: use ESP32 OTA partitions (two app slots).
- **Signature / integrity**: at minimum SHA-256 check; ideally signed manifests.
- **Rollback**: mark new firmware as pending, confirm after healthy boot.
- **Controls**: admin can set a new manifest and optionally force an update.

## Rollback

- Keep previous firmware `.bin` from PlatformIO builds.
- If OTA is enabled later, enforce rollback on boot failure and allow pinning a previous manifest.

