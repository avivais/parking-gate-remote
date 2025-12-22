# MQTT Configuration Setup

This directory contains the Mosquitto MQTT broker configuration files.

## Password File Generation

The `passwordfile` must be generated before starting the broker. It contains hashed passwords for MQTT users.

### Prerequisites

You need `mosquitto_passwd` installed. On macOS:
```bash
brew install mosquitto
```

On Ubuntu/Debian:
```bash
sudo apt-get install mosquitto-clients
```

### Generate Password File

1. Create the password file with the server user:
```bash
mosquitto_passwd -c mqtt/passwordfile pgr_server
# Enter password when prompted (or use default: pgr_dev_password_change_me)
```

2. Add the device user:
```bash
mosquitto_passwd -b mqtt/passwordfile pgr_device_mitspe6 <device_password>
```

Or add interactively:
```bash
mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6
```

### Default Users

- **pgr_server**: Server-side user (backend)
  - Default password: `pgr_dev_password_change_me` (CHANGE IN PRODUCTION!)
  - Can publish to: `pgr/mitspe6/gate/cmd`
  - Can subscribe to: `pgr/mitspe6/gate/ack`, `pgr/mitspe6/gate/status`

- **pgr_device_mitspe6**: Device user (microcontroller)
  - Password: Set during device setup
  - Can subscribe to: `pgr/mitspe6/gate/cmd`
  - Can publish to: `pgr/mitspe6/gate/ack`, `pgr/mitspe6/gate/status`

### Security Note

**NEVER commit the `passwordfile` to git!** It contains hashed passwords. The file is already in `.gitignore`.

## TLS Certificates (Development)

For development, self-signed certificates can be used. The `certs/` directory should contain:

- `ca.crt` - Certificate Authority certificate
- `server.crt` - Server certificate
- `server.key` - Server private key

### Generate Self-Signed Certificates (Dev Only)

```bash
cd mqtt/certs

# Generate CA key and certificate
openssl req -new -x509 -days 3650 -extensions v3_ca -keyout ca.key -out ca.crt -subj "/CN=MQTT-CA"

# Generate server key
openssl genrsa -out server.key 2048

# Generate server certificate signing request
openssl req -new -out server.csr -key server.key -subj "/CN=mosquitto"

# Generate server certificate signed by CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650

# Clean up CSR
rm server.csr
```

**Note:** For production, use proper certificates from a trusted CA.

## Directory Structure

```
mqtt/
├── mosquitto.conf      # Main broker configuration
├── aclfile             # Access Control List
├── passwordfile        # User passwords (gitignored, generate manually)
├── README.md           # This file
├── certs/              # TLS certificates (gitignored, generate manually)
│   ├── ca.crt
│   ├── server.crt
│   └── server.key
└── data/               # Persistence data (gitignored, created by docker)
```

