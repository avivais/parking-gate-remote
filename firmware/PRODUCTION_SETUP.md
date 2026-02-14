# Production Firmware Setup - Quick Reference

## What's Been Done

✅ Updated `config.h` with production MQTT settings:
- MQTT_HOST: `mqtt.mitzpe6-8.com`
- MQTT_USERNAME: `pgr_device_mitspe6`
- FW_VERSION: `fw-prod-1.0.0`

✅ Updated `main.ino` to use production config values

✅ Created `convert-ca-cert.sh` script for CA certificate conversion

## What You Need to Do

### 1. Get Production MQTT Password

SSH into your server and get the device password:

```bash
# Option 1: If you remember it from server-setup.sh
# Just use that password

# Option 2: Reset the password
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com
cd /opt/parking-gate-remote/mqtt
mosquitto_passwd passwordfile pgr_device_mitspe6
# Enter the new password when prompted
```

### 2. Update MQTT Password in config.h

Edit `firmware/src/config/config.h` and replace:
```cpp
#define MQTT_PASSWORD "REPLACE_WITH_PRODUCTION_PASSWORD"
```
with your actual password.

### 3. Get and Convert CA Certificate

```bash
# Copy CA certificate from server
scp -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com:/opt/parking-gate-remote/mqtt/certs/ca.crt /tmp/prod-ca.crt

# Convert to header file
cd firmware
./convert-ca-cert.sh /tmp/prod-ca.crt
```

This will create `src/config/ProductionRootCA.h` with the production certificate.

### 4. Build and Flash

```bash
cd firmware

# Build
pio run

# Flash (you'll do this part)
pio run -t upload
```

## Verification

After flashing, monitor serial output:
```bash
pio device monitor
```

Expected:
- Modem initialization
- PPP connection
- MQTT connection to `mqtt.mitzpe6-8.com:8883`
- Status messages every 5 seconds
- No TLS/certificate errors

## Troubleshooting

**Certificate errors**: Make sure you ran `convert-ca-cert.sh` and the certificate is valid

**Connection refused**:
- Check DNS resolves `mqtt.mitzpe6-8.com` (or use EC2 IP instead)
- Verify port 8883 is open in EC2 Security Group

**Authentication failed**:
- Double-check MQTT_USERNAME and MQTT_PASSWORD in config.h
- Verify password matches server passwordfile

