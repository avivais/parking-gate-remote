# Deployment Checklist

Use this checklist to ensure all steps are completed correctly.

## Pre-Deployment (Local Machine)

- [ ] Update backend CORS in `backend/src/main.ts` to include `https://app.mitzpe6-8.com`
- [ ] Build backend: `cd backend && npm install && npm run build`
- [ ] Build frontend: `cd frontend && NEXT_PUBLIC_API_BASE=https://api.mitzpe6-8.com/api npm run build`
- [ ] Verify all deployment files are in `deploy/` directory
- [ ] Test build scripts locally

## Server Initial Setup

- [ ] SSH into EC2 instance
- [ ] Install Docker and Docker Compose (if not installed)
- [ ] Create project directory: `sudo mkdir -p /opt/parking-gate-remote/{backend,frontend,mqtt/certs}`
- [ ] Set ownership: `sudo chown -R ubuntu:ubuntu /opt/parking-gate-remote`

## Copy Files to Server

- [ ] Copy backend `dist/` directory
- [ ] Copy backend `package.json` and `package-lock.json`
- [ ] Copy backend `Dockerfile`
- [ ] Copy frontend `.next/` directory
- [ ] Copy frontend `package.json`, `package-lock.json`, `next.config.ts`
- [ ] Copy frontend `public/` directory
- [ ] Copy frontend `Dockerfile.prod` as `Dockerfile`
- [ ] Copy `docker-compose.prod.yml` as `docker-compose.yml`
- [ ] Copy `docker-compose.mqtt.prod.yml` as `docker-compose.mqtt.yml`
- [ ] Copy `mosquitto.prod.conf` to `mqtt/mosquitto.conf`
- [ ] Copy `mqtt/aclfile` to `mqtt/aclfile`
- [ ] Copy `backend.env.template` to `backend/.env.template`
- [ ] Copy Apache configuration files to `/tmp/apache-configs/`

## MQTT Configuration

- [ ] Generate TLS certificates in `mqtt/certs/`
- [ ] Verify certificates: `ca.crt`, `ca.key`, `server.crt`, `server.key` exist
- [ ] Set certificate permissions: `chmod 644 *.crt && chmod 600 *.key`
- [ ] Create password file: `mosquitto_passwd -c mqtt/passwordfile pgr_server`
- [ ] Add device user: `mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6`
- [ ] Set password file permissions: `chmod 600 mqtt/passwordfile`
- [ ] Verify `mqtt/mosquitto.conf` is configured for TLS on port 8883
- [ ] Verify `mqtt/aclfile` has correct permissions

## Backend Configuration

- [ ] Create `backend/.env` from template
- [ ] Set `MONGO_URI=mongodb://mongo:27017/parking-gate`
- [ ] Set strong `JWT_SECRET` (generate random string)
- [ ] Set `GATE_DEVICE_MODE=mqtt`
- [ ] Set `MQTT_URL=mqtts://mqtt:8883`
- [ ] Set `MQTT_USERNAME=pgr_server`
- [ ] Set strong `MQTT_PASSWORD` (match password file)
- [ ] Verify all other environment variables are set

## Docker Setup

- [ ] Create Docker network: `docker network create parking_net`
- [ ] Verify `docker-compose.yml` is correct
- [ ] Verify `docker-compose.mqtt.yml` is correct

## Apache Configuration

- [ ] Install certbot: `sudo apt-get install certbot python3-certbot-apache`
- [ ] Get SSL certificate for `api.mitzpe6-8.com`: `sudo certbot --apache -d api.mitzpe6-8.com`
- [ ] Copy Apache vhost files to `/etc/apache2/sites-available/`
- [ ] Enable required modules: `sudo a2enmod proxy proxy_http ssl rewrite`
- [ ] Enable sites: `sudo a2ensite api.mitzpe6-8.com mitzpe6-8.com`
- [ ] Test Apache config: `sudo apache2ctl configtest`
- [ ] Update `app.mitzpe6-8.com-le-ssl.conf` to proxy to frontend
- [ ] Reload Apache: `sudo systemctl reload apache2`

## Firewall Configuration

- [ ] Allow HTTP: `sudo ufw allow 80/tcp`
- [ ] Allow HTTPS: `sudo ufw allow 443/tcp`
- [ ] Allow MQTT TLS: `sudo ufw allow 8883/tcp`
- [ ] Deny MQTT non-TLS: `sudo ufw deny 1883/tcp`
- [ ] Enable firewall: `sudo ufw --force enable`
- [ ] Verify firewall status: `sudo ufw status`

## Start Services

- [ ] Start MongoDB: `docker-compose up -d mongo`
- [ ] Wait for MongoDB to be ready (check logs)
- [ ] Start MQTT broker: `docker-compose -f docker-compose.mqtt.yml up -d`
- [ ] Verify MQTT broker is running (check logs)
- [ ] Start backend: `docker-compose up -d backend`
- [ ] Verify backend is running (check logs)
- [ ] Start frontend: `docker-compose up -d frontend`
- [ ] Verify frontend is running (check logs)

## Verification

- [ ] Test API endpoint: `curl https://api.mitzpe6-8.com/api`
- [ ] Test frontend: Open `https://app.mitzpe6-8.com` in browser
- [ ] Test root domain redirect: `curl -I http://mitzpe6-8.com` (should redirect)
- [ ] Verify backend can connect to MongoDB (check logs)
- [ ] Verify backend can connect to MQTT broker (check logs)
- [ ] Test user registration
- [ ] Test user login
- [ ] Test gate open command (if device connected)
- [ ] Test MQTT TLS connection from external device

## Post-Deployment

- [ ] Create admin user (via API or MongoDB)
- [ ] Set up log rotation for Docker containers
- [ ] Configure MongoDB backup script
- [ ] Document backup restoration process
- [ ] Set up monitoring (optional)
- [ ] Review security settings
- [ ] Update documentation with production URLs

## Troubleshooting

If services fail to start:

1. Check Docker logs: `docker logs <container-name>`
2. Verify environment variables: `docker exec <container> env`
3. Check Apache error logs: `sudo tail -f /var/log/apache2/*error.log`
4. Verify network connectivity: `docker network inspect parking_net`
5. Check firewall rules: `sudo ufw status verbose`
6. Verify SSL certificates: `sudo certbot certificates`

## Rollback Plan

If deployment fails:

1. Stop all services: `docker-compose down && docker-compose -f docker-compose.mqtt.yml down`
2. Restore previous Apache configurations
3. Remove new virtual hosts: `sudo a2dissite api.mitzpe6-8.com mitzpe6-8.com`
4. Reload Apache: `sudo systemctl reload apache2`
5. Review logs to identify issues
6. Fix issues and retry deployment

