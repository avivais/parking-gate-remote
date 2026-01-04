#!/bin/bash
# Build and deploy script - run from project root
# This script builds the applications and prepares them for deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Building Applications ===${NC}"

# Build Backend
echo -e "\n${YELLOW}Building backend...${NC}"
cd backend
npm install
npm run build
cd ..

# Build Frontend
echo -e "\n${YELLOW}Building frontend...${NC}"
cd frontend
npm install
NEXT_PUBLIC_API_BASE=https://api.mitzpe6-8.com/api npm run build
cd ..

echo -e "\n${GREEN}=== Build Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Copy backend/dist, backend/package*.json, backend/Dockerfile to server"
echo "2. Copy frontend/.next, frontend/package*.json, frontend/next.config.ts, frontend/public, frontend/Dockerfile.prod to server"
echo "3. Copy deploy/* files to server"
echo ""
echo "Use the deployment commands in deploy/README.md"

