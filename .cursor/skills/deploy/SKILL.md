---
name: deploy
description: Guides production deployment for the Parking Gate Remote app (this repo only). Runs local build, copies to EC2, then server setup or start. Use when the user wants to deploy, deploy to production, or run deploy steps. Fails the process if the build fails.
---

# Deploy to Production (Parking Gate Remote)

Use this skill when deploying this repository to production. Build is always run first; if it fails, stop and fix before copying or touching the server.

## Prerequisites

- SSH key: `$HOME/.ssh/VaisenKey.pem` (or set `SSH_KEY`)
- Server: `ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com`
- Project dir on server: `/opt/parking-gate-remote`
- Run from **project root** (parking-gate-remote).

## Workflow Overview

1. **Build** (local) — required; **fail the process if build fails**.
2. **Copy to server** (local).
3. **On server**: first-time setup **or** update (start services only).

---

## Step 1: Build (Local)

Run from project root. If this fails, **do not proceed**; fix the build and rerun.

```
./deploy/build-and-deploy.sh
```

---

## Step 2: Copy to Server (Local)

Only after Step 1 succeeds:
```
export SSH_KEY="${SSH_KEY:-$HOME/.ssh/VaisenKey.pem}"
./deploy/copy-to-server.sh
```

* Packs backend dist/, frontend .next/, deploy configs, and scripts into a tarball and copies to server at /opt/parking-gate-remote.
* Requires backend/dist and frontend/.next (from Step 1).

---

## Step 3: On Server

SSH in:
```
ssh -i "$HOME/.ssh/VaisenKey.pem" ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com
```

** First-time deployment **
Run once per server (certs, .env, Apache, firewall):
```
cd /opt/parking-gate-remote
./server-setup.sh
sudo ./setup-apache.sh
sudo ufw allow 80,443,8883/tcp
sudo ufw deny 1883/tcp
sudo ufw --force enable
./start-services.sh
```

** Update / re-deploy **
After a new copy; only restart services:
```
cd /opt/parking-gate-remote
./start-services.sh
```
docker ps
docker logs parking-backend --tail 50
docker logs parking-frontend --tail 50
curl -s -o /dev/null -w "%{http_code}" https://api.mitzpe6-8.com/api
```

* Backend `.env`: ensure `JWT_SECRET` and `MQTT_PASSWORD` match `mqtt/passwordfile` when changing MQTT credentials.

