# Security Configuration Guide

This document describes the security configuration for the production deployment.

## UFW Firewall (Server-Side)

The UFW firewall has been configured on the server with the following rules:

- **Allow SSH (22/tcp)**: For server access
- **Allow HTTP (80/tcp)**: For Let's Encrypt certificate validation
- **Allow HTTPS (443/tcp)**: For web traffic
- **Allow MQTT TLS (8883/tcp)**: For MQTT device communication
- **Deny MQTT non-TLS (1883/tcp)**: Explicitly deny insecure MQTT

To verify UFW status:
```bash
sudo ufw status verbose
```

## EC2 Security Group (AWS Console)

You must configure the EC2 Security Group in AWS Console to match the UFW rules.

### Steps:

1. **Find Your Instance**
   - Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
   - Navigate to Instances
   - Find your instance (or use the instance ID from the server)

2. **Get Instance ID** (from server):
   ```bash
   curl -s http://169.254.169.254/latest/meta-data/instance-id
   ```

3. **Configure Security Group**
   - Click on your instance
   - Go to the "Security" tab
   - Click on the Security Group name
   - Click "Edit inbound rules"

4. **Add/Update Rules**:

   | Type | Protocol | Port Range | Source | Description |
   |------|----------|------------|--------|-------------|
   | SSH | TCP | 22 | Your IP or 0.0.0.0/0 | Server access |
   | HTTP | TCP | 80 | 0.0.0.0/0 | Let's Encrypt validation |
   | HTTPS | TCP | 443 | 0.0.0.0/0 | Web traffic |
   | Custom TCP | TCP | 8883 | 0.0.0.0/0 | MQTT TLS |

5. **Remove/Deny Port 1883**:
   - If there's a rule for port 1883, delete it
   - This ensures non-TLS MQTT is blocked at the AWS level

6. **Save Rules**

### Using AWS CLI (Alternative)

If you have AWS CLI configured:

```bash
# Get Security Group ID
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
SG_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)

# Add rules (example - adjust as needed)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 8883 \
  --cidr 0.0.0.0/0
```

## Security Best Practices

1. **SSH Access**: Consider restricting SSH (port 22) to your specific IP instead of 0.0.0.0/0
2. **MQTT TLS**: Always use port 8883 (TLS) - port 1883 is explicitly denied
3. **Regular Updates**: Keep the server updated: `sudo apt update && sudo apt upgrade`
4. **Monitor Logs**: Regularly check Apache and Docker logs for suspicious activity
5. **Backup**: Set up regular backups of MongoDB data (see backup strategy below)

## Verification

After configuring both UFW and EC2 Security Group:

1. **Test HTTP**: `curl http://mitzpe6-8.com` (should redirect to HTTPS)
2. **Test HTTPS**: `curl https://app.mitzpe6-8.com` (should return HTML)
3. **Test API**: `curl https://api.mitzpe6-8.com/api` (should return JSON)
4. **Test MQTT TLS**: Use an MQTT client to connect to `mitzpe6-8.com:8883` with TLS

## Troubleshooting

- **Can't connect to server**: Check EC2 Security Group allows SSH from your IP
- **Website not accessible**: Check both UFW and EC2 Security Group allow ports 80/443
- **MQTT connection fails**: Verify port 8883 is open in both UFW and EC2 Security Group

