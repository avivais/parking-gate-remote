# MCU Firmware Flashing Guide - Production

This guide covers the final step: flashing the ESP32 MCU with production firmware.

## Prerequisites

- ✅ Server deployment completed (all services running)
- ✅ MQTT broker running on EC2 with TLS certificates generated
- ✅ MQTT device user created (`pgr_device_mitspe6`)
- ✅ Production CA certificate available (`mqtt/certs/ca.crt` on server)
- ✅ ESP32 TTGO board with A7670G modem connected via USB
- ✅ PlatformIO installed locally

## Step 1: Get Production MQTT Credentials

SSH into your EC2 server and retrieve:

1. **MQTT Device Password**:
   ```bash
   # On server
   cd /opt/parking-gate-remote/mqtt
   # The password for pgr_device_mitspe6 was set during server-setup.sh
   # If you need to reset it:
   mosquitto_passwd passwordfile pgr_device_mitspe6
   ```

2. **CA Certificate**:
   ```bash
   # On server
   cat /opt/parking-gate-remote/mqtt/certs/ca.crt
   ```
   Copy the entire certificate (including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`)

3. **MQTT Broker Hostname**:
   - Option 1: Use EC2 public IP (if DNS not configured for mqtt.mitzpe6-8.com)
   - Option 2: Use `mqtt.mitzpe6-8.com` (if DNS A record exists)
   - Option 3: Use `api.mitzpe6-8.com` (if same server)

   **Note**: The certificate is issued for `mqtt.mitzpe6-8.com`, so if using IP or different hostname, you may need to disable certificate verification or update the certificate.

## Step 2: Update Firmware Configuration

On your local machine, edit `firmware/src/config/config.h`:

```cpp
// Device Identification
#define DEVICE_ID "mitspe6-gate-001"  // Change per device if needed

// MQTT Broker Configuration (Production EC2)
#define MQTT_HOST "mqtt.mitzpe6-8.com"  // Or EC2 public IP
#define MQTT_PORT 8883  // TLS port
#define MQTT_USERNAME "pgr_device_mitspe6"
#define MQTT_PASSWORD "YOUR_DEVICE_PASSWORD_HERE"  // From server

// MQTT Topics (Production)
#define MQTT_CMD_TOPIC "pgr/mitspe6/gate/cmd"
#define MQTT_ACK_TOPIC "pgr/mitspe6/gate/ack"
#define MQTT_STATUS_TOPIC "pgr/mitspe6/gate/status"
```

**Important**: Update `FW_VERSION` to production:
```cpp
#define FW_VERSION "fw-prod-1.0.0"
```

## Step 3: Update CA Certificate

Replace the HiveMQ CA certificate with your production CA certificate:

1. **Copy CA certificate from server** to your local machine:
   ```bash
   # From local machine
   scp -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com:/opt/parking-gate-remote/mqtt/certs/ca.crt /tmp/prod-ca.crt
   ```

2. **Convert to header format**:
   ```bash
   # On local machine
   cd firmware/src/config

   # Create new certificate header file
   cat > ProductionRootCA.h << 'EOF'
   #include <pgmspace.h>
   // Production MQTT CA Certificate
   static const char ProductionRootCA[] PROGMEM =
   EOF

   # Convert certificate to C string format (each line as a string)
   while IFS= read -r line; do
       echo "\"$line\\r\\n\"" >> ProductionRootCA.h
   done < /tmp/prod-ca.crt

   echo ";" >> ProductionRootCA.h
   ```

3. **Update firmware to use production CA**:

   Edit `firmware/src/main.ino`:

   - **Line 5**: Change:
     ```cpp
     #include "config/HivemqRootCA.h"  // Root CA certificate for HiveMQ TLS
     ```
     to:
     ```cpp
     #include "config/ProductionRootCA.h"  // Root CA certificate for Production MQTT TLS
     ```

   - **Line 311**: Change:
     ```cpp
     if (mqttManager->initializeModemMqtt(true, true, HivemqRootCA)) {
     ```
     to:
     ```cpp
     if (mqttManager->initializeModemMqtt(true, true, ProductionRootCA)) {
     ```

4. **Update MQTT connection to use production config** (if needed):

   The code currently uses `TEST_MQTT_HOST` etc. For production, you may want to update line 304 in `main.ino`:

   Change:
   ```cpp
   mqttManager->begin(TEST_MQTT_HOST, TEST_MQTT_PORT, TEST_MQTT_USERNAME, TEST_MQTT_PASSWORD);
   ```
   to:
   ```cpp
   mqttManager->begin(MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD);
   ```

   This will use the values from `config.h` instead of the test values.

## Step 4: Build and Flash Firmware

1. **Find your ESP32 serial port**:
   ```bash
   cd firmware
   pio device list
   ```
   Note the port (e.g., `/dev/cu.wchusbserial589A0084711` on macOS)

2. **Build the firmware**:
   ```bash
   pio run
   ```

3. **Flash to ESP32**:
   ```bash
   # Replace PORT with your actual port
   pio run -t upload --upload-port /dev/cu.wchusbserial589A0084711
   ```

   Or if PlatformIO auto-detects:
   ```bash
   pio run -t upload
   ```

## Step 5: Monitor Serial Output

After flashing, monitor the serial output to verify connection:

```bash
pio device monitor
```

**Expected output**:
- Modem initialization
- PPP connection established
- MQTT connection to production broker
- Status messages every 5 seconds
- No connection errors

## Step 6: Verify Production Connection

1. **Check MQTT broker logs** (on server):
   ```bash
   docker logs parking-mosquitto -f
   ```
   You should see the device connecting and publishing status messages.

2. **Test gate command** (from frontend or API):
   - Log into the web app
   - Send a gate open command
   - Verify ACK is received

3. **Check backend logs** (on server):
   ```bash
   docker logs parking-backend -f
   ```
   You should see MQTT command publishing and ACK reception.

## Troubleshooting

### Device won't connect to MQTT broker

1. **Check DNS resolution**:
   - If using hostname, ensure DNS resolves correctly
   - Try using EC2 public IP instead

2. **Check certificate**:
   - Verify CA certificate matches the server certificate
   - Check certificate format (must include BEGIN/END markers)

3. **Check credentials**:
   - Verify MQTT username and password match server configuration
   - Check ACL file allows device user to publish/subscribe

4. **Check network**:
   - Ensure cellular modem has internet connectivity
   - Verify APN settings are correct for your SIM card

### Certificate verification fails

If using IP address instead of hostname, you may need to:
- Disable certificate hostname verification (not recommended for production)
- Or update certificate to include IP address in SAN

### Serial monitor shows connection errors

1. Check serial baud rate (should be 115200)
2. Verify modem is powered on
3. Check SIM card is inserted and has service
4. Review modem initialization logs

## Post-Flashing Checklist

- [ ] Device connects to MQTT broker successfully
- [ ] Status messages are published every 5 seconds
- [ ] Backend receives status messages
- [ ] Gate open command works from frontend
- [ ] ACK messages are received by backend
- [ ] Device reconnects automatically after network interruption
- [ ] Serial logs show no errors

## Notes

- **Device ID**: Each physical device should have a unique `DEVICE_ID`
- **Firmware Version**: Update `FW_VERSION` for each production release
- **Certificate Updates**: If server certificate changes, update firmware and re-flash
- **Password Security**: Never commit production passwords to git

