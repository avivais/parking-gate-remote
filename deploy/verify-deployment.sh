#!/usr/bin/env bash
# Verify production deployment: API reachable, containers up, backend subscribed to diagnostics.
# Run from project root or deploy/. Uses same server/key as copy-to-server.sh.

set -e

SERVER="${1:-ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com}"
KEY="${SSH_KEY:-$HOME/.ssh/VaisenKey.pem}"
API_BASE="${API_BASE:-https://api.mitzpe6-8.com}"

FAILED=0

echo "=== Verify Deployment ==="
echo "  Server: $SERVER"
echo "  API:    $API_BASE"
echo ""

# --- 1. API responds ---
echo "1. Checking API..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$API_BASE/api" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|301|302|304)$ ]]; then
    echo "   OK   API responded with HTTP $HTTP_CODE"
else
    echo "   FAIL API returned HTTP $HTTP_CODE (expected 200/301/302)"
    FAILED=1
fi

# --- 2. SSH and check containers + logs ---
if [[ ! -f "$KEY" ]]; then
    echo ""
    echo "   SKIP SSH key not found at $KEY; skipping server checks."
    echo "   Set SSH_KEY or run: ./deploy/verify-deployment.sh [server]"
    [[ $FAILED -eq 1 ]] && exit 1
    exit 0
fi

echo ""
echo "2. Checking server (containers and backend logs)..."
LOG_SNAPSHOT=$(ssh -i "$KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$SERVER" "
echo '--- docker ps ---'
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -20
echo ''
echo '--- backend log tail ---'
docker logs parking-backend --tail 40 2>&1
" 2>/dev/null) || LOG_SNAPSHOT=""

if [[ -z "$LOG_SNAPSHOT" ]]; then
    echo "   FAIL Could not SSH or run docker (check key and server)"
    FAILED=1
else
    if echo "$LOG_SNAPSHOT" | grep -q "parking-backend.*Up"; then
        echo "   OK   Backend container is up"
    else
        echo "   FAIL Backend container not seen or not Up"
        FAILED=1
    fi

    if echo "$LOG_SNAPSHOT" | grep -q "diagnostics"; then
        echo "   OK   Backend subscribed to diagnostics topic"
    else
        echo "   WARN Backend log does not show 'diagnostics' (subscription message may have scrolled away)"
    fi

    if echo "$LOG_SNAPSHOT" | grep -q "Subscribed to topics"; then
        echo "   OK   Backend MQTT subscription line found"
    else
        echo "   WARN 'Subscribed to topics' not in last 40 log lines"
    fi
fi

echo ""
if [[ $FAILED -eq 0 ]]; then
    echo "=== Verification passed ==="
    exit 0
else
    echo "=== Verification had failures ==="
    exit 1
fi
