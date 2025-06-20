# RandomChat Deployment Options

This document provides quick deployment options for your RandomChat application.

## 🚀 Quick Deployment Options

### Option 1: Direct VPS Deployment (Recommended)

**Best for**: Production environments with full control

1. **Upload files to your VPS**:
   ```bash
   # On your local machine
   scp -r . user@your-vps-ip:/var/www/RandomChat/
   ```

2. **SSH into your VPS and run**:
   ```bash
   cd /var/www/RandomChat
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Update domain in deploy.sh** before running:
   ```bash
   nano deploy.sh
   # Change DOMAIN="your-domain.com" to your actual domain
   ```

### Option 2: Docker Deployment

**Best for**: Containerized environments, easy scaling

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

2. **For production with SSL**:
   ```bash
   # Create SSL directory
   mkdir ssl
   # Add your SSL certificates to ssl/ directory
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Option 3: Manual Deployment

**Best for**: Custom configurations, learning

Follow the detailed guide in `deployment-guide.md`

## 🔧 Pre-deployment Checklist

- [ ] Update domain names in configuration files
- [ ] Set secure passwords in `.env` file
- [ ] Configure SSL certificates
- [ ] Set up DNS records
- [ ] Configure firewall rules
- [ ] Set up monitoring and backups

## 📋 Required Files for Deployment

### Essential Files:
- `server/` - Backend application
- `client/` - Frontend application
- `ecosystem.config.js` - PM2 configuration
- `nginx.conf` - Nginx configuration
- `deploy.sh` - Deployment script
- `.env.example` - Environment template

### Optional Files:
- `docker-compose.yml` - Docker deployment
- `Dockerfile.server` - Server container
- `Dockerfile.client` - Client container

## 🌐 Domain Configuration

### DNS Records:
```
A     @     your-server-ip
A     www   your-server-ip
```

### SSL Certificate:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 🔒 Security Checklist

- [ ] Change default admin credentials
- [ ] Set up firewall (UFW)
- [ ] Enable SSL/HTTPS
- [ ] Configure rate limiting
- [ ] Set up regular backups
- [ ] Monitor logs and access
- [ ] Keep system updated

## 📊 Monitoring Commands

```bash
# Check application status
pm2 status
pm2 logs randomchat-server

# Check Nginx status
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Monitor system resources
htop
df -h
free -h

# Check application health
curl http://localhost:5000/health
```

## 🚨 Troubleshooting

### Common Issues:

1. **Port 5000 already in use**:
   ```bash
   sudo netstat -tulpn | grep :5000
   sudo kill -9 <PID>
   ```

2. **Nginx 502 error**:
   ```bash
   pm2 restart randomchat-server
   sudo systemctl reload nginx
   ```

3. **WebSocket connection issues**:
   - Check Nginx WebSocket configuration
   - Verify firewall settings
   - Check browser console for errors

4. **Permission issues**:
   ```bash
   sudo chown -R $USER:$USER /var/www/RandomChat
   sudo chmod -R 755 /var/www/RandomChat
   ```

## 📞 Support

If you encounter issues:

1. Check the logs: `pm2 logs randomchat-server`
2. Verify configuration files
3. Test connectivity: `curl http://localhost:5000`
4. Check system resources
5. Review the detailed deployment guide

## 🔄 Updates and Maintenance

### Regular Maintenance:
```bash
# Update application
git pull origin main
pm2 restart randomchat-server

# Update system
sudo apt update && sudo apt upgrade

# Renew SSL certificate
sudo certbot renew

# Check backups
ls -la /var/backups/randomchat/
```

### Monitoring Setup:
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure log monitoring (Logwatch, Fail2ban)
- Set up resource monitoring (htop, iotop)
- Enable email alerts for critical issues 