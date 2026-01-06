#!/bin/bash
# Fix MQTT Security Group - Add port 8883 to EC2 Security Group
# This script uses AWS CLI to add the MQTT TLS port to the security group

set -e

echo "=== Fixing MQTT Security Group ==="
echo ""

# Get instance ID
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
echo "Instance ID: $INSTANCE_ID"

# Get Security Group ID
SG_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text 2>/dev/null)

if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
    echo "ERROR: Could not get Security Group ID"
    echo "Please add port 8883 manually in AWS Console:"
    echo "1. Go to EC2 Console -> Security Groups"
    echo "2. Find the security group attached to instance $INSTANCE_ID"
    echo "3. Add inbound rule: Custom TCP, Port 8883, Source 0.0.0.0/0"
    exit 1
fi

echo "Security Group ID: $SG_ID"
echo ""

# Check if rule already exists
EXISTING=$(aws ec2 describe-security-groups --group-ids $SG_ID --query "SecurityGroups[0].IpPermissions[?FromPort==\`8883\` && ToPort==\`8883\`]" --output text 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
    echo "✓ Port 8883 rule already exists in Security Group"
else
    echo "Adding port 8883 to Security Group..."
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 8883 \
        --cidr 0.0.0.0/0 \
        --description "MQTT TLS" 2>/dev/null && echo "✓ Port 8883 added successfully" || {
        echo "ERROR: Failed to add rule"
        echo "Please add manually in AWS Console:"
        echo "1. Go to EC2 Console -> Security Groups"
        echo "2. Find security group: $SG_ID"
        echo "3. Add inbound rule: Custom TCP, Port 8883, Source 0.0.0.0/0"
        exit 1
    }
fi

echo ""
echo "=== Security Group Updated ==="
echo "Port 8883 should now be accessible from the internet"

