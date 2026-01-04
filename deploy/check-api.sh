#!/bin/bash
# Diagnostic script to check API connectivity
# Run this on the server

echo "=== API Connectivity Check ==="
echo ""

# Check if backend container is running
echo "1. Checking backend container..."
if docker ps | grep -q parking-backend; then
    echo "   ✓ Backend container is running"
    docker ps | grep parking-backend
else
    echo "   ✗ Backend container is NOT running"
    echo "   Check logs: docker logs parking-backend"
fi

echo ""

# Check if backend is listening on port 3001
echo "2. Checking if backend is listening on port 3001..."
if netstat -tuln 2>/dev/null | grep -q ":3001 " || ss -tuln 2>/dev/null | grep -q ":3001 "; then
    echo "   ✓ Port 3001 is listening"
else
    echo "   ✗ Port 3001 is NOT listening"
fi

echo ""

# Test backend directly
echo "3. Testing backend directly (localhost:3001)..."
if curl -s http://localhost:3001/api > /dev/null; then
    echo "   ✓ Backend responds on localhost:3001"
    curl -s http://localhost:3001/api | head -c 100
    echo ""
else
    echo "   ✗ Backend does NOT respond on localhost:3001"
    echo "   Error: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api 2>&1)"
fi

echo ""

# Test through Apache proxy
echo "4. Testing through Apache proxy (api.mitzpe6-8.com)..."
if curl -s -k https://api.mitzpe6-8.com/api > /dev/null; then
    echo "   ✓ Apache proxy responds"
    curl -s -k https://api.mitzpe6-8.com/api | head -c 100
    echo ""
else
    echo "   ✗ Apache proxy does NOT respond"
    echo "   Error: $(curl -s -k -o /dev/null -w '%{http_code}' https://api.mitzpe6-8.com/api 2>&1)"
fi

echo ""

# Check Apache error logs
echo "5. Recent Apache errors (last 5 lines)..."
sudo tail -5 /var/log/apache2/api.mitzpe6-8.com-error.log 2>/dev/null || echo "   No error log found"

echo ""

# Check backend logs
echo "6. Recent backend logs (last 10 lines)..."
docker logs --tail 10 parking-backend 2>/dev/null || echo "   Backend container not found"

echo ""
echo "=== Check Complete ==="

