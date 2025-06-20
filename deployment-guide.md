# RandomChat VPS Deployment Guide

This guide will help you deploy your RandomChat application on a VPS using Nginx as a reverse proxy, PM2 for process management, and SSL certificates.

## Prerequisites

- A VPS with Ubuntu 20.04+ or CentOS 8+
- Root or sudo access
- A domain name (optional but recommended for SSL)
- Node.js 16+ installed on your VPS

## Step 1: Server Setup

### 1.1 Update your system
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js and npm
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 1.3 Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 1.4 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 1.5 Install Certbot for SSL (optional)
```bash
sudo apt install certbot python3-certbot-nginx -y
```

## Step 2: Application Deployment

### 2.1 Clone your repository
```bash
cd /var/www
sudo git clone https://github.com/yourusername/RandomChat.git
sudo chown -R $USER:$USER RandomChat
cd RandomChat
```

### 2.2 Install dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2.3 Build the React client
```bash
cd client
npm run build
```

### 2.4 Configure environment variables
```bash
cd ../server
cp .env.example .env
nano .env
```

Add your configuration:
```env
PORT=5000
NODE_ENV=production
ADMIN_SECRET=your_secure_admin_secret_here
```

## Step 3: Nginx Configuration

### 3.1 Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/randomchat
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS (uncomment after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Client static files
    location / {
        root /var/www/RandomChat/client/build;
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }

    # API and WebSocket proxy
    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket connections
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Admin panel
    location /admin {
        root /var/www/RandomChat/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
}
```

### 3.2 Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/randomchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 4: PM2 Configuration

### 4.1 Create PM2 ecosystem file
```bash
cd /var/www/RandomChat
nano ecosystem.config.js
```

Add the following configuration:
```javascript
module.exports = {
  apps: [{
    name: 'randomchat-server',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 4.2 Create logs directory
```bash
mkdir logs
```

### 4.3 Start the application
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 5: SSL Certificate (Optional but Recommended)

### 5.1 Get SSL certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 5.2 Auto-renewal
```bash
sudo crontab -e
```

Add this line:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 6: Firewall Configuration

### 6.1 Configure UFW
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 7: Monitoring and Maintenance

### 7.1 PM2 monitoring
```bash
pm2 monit
pm2 logs
```

### 7.2 Nginx logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Step 8: Backup Strategy

### 8.1 Create backup script
```bash
nano /var/www/backup.sh
```

Add the following:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/randomchat"
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/RandomChat

# Backup database
cp /var/www/RandomChat/server/admin.db $BACKUP_DIR/admin_$DATE.db

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 8.2 Make executable and schedule
```bash
chmod +x /var/www/backup.sh
crontab -e
```

Add this line for daily backups:
```
0 2 * * * /var/www/backup.sh
```

## Troubleshooting

### Common Issues:

1. **Port already in use**: Check if another process is using port 5000
   ```bash
   sudo netstat -tulpn | grep :5000
   ```

2. **Nginx 502 error**: Check if the Node.js server is running
   ```bash
   pm2 status
   pm2 logs randomchat-server
   ```

3. **WebSocket connection issues**: Ensure Nginx is properly configured for WebSocket proxying

4. **Permission issues**: Check file permissions
   ```bash
   sudo chown -R www-data:www-data /var/www/RandomChat
   ```

### Useful Commands:

- Restart application: `pm2 restart randomchat-server`
- View logs: `pm2 logs randomchat-server`
- Monitor resources: `pm2 monit`
- Reload Nginx: `sudo systemctl reload nginx`
- Check Nginx status: `sudo systemctl status nginx`

## Security Considerations

1. **Firewall**: Only allow necessary ports (80, 443, 22)
2. **SSL**: Always use HTTPS in production
3. **Environment variables**: Never commit sensitive data to version control
4. **Regular updates**: Keep your system and dependencies updated
5. **Monitoring**: Set up monitoring for uptime and performance
6. **Backups**: Regular backups of application and database

## Performance Optimization

1. **Enable Nginx caching** for static assets
2. **Use CDN** for better global performance
3. **Monitor memory usage** and adjust PM2 settings
4. **Enable compression** (already configured in Nginx)
5. **Consider load balancing** for high traffic

Your RandomChat application should now be successfully deployed and accessible at your domain! 