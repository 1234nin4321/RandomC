#!/bin/bash

# RandomChat Deployment Script
# This script automates the deployment process on a VPS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="RandomChat"
APP_DIR="/var/www/RandomChat"
BACKUP_DIR="/var/backups/randomchat"
DOMAIN="your-domain.com"  # Change this to your domain

echo -e "${BLUE}🚀 Starting RandomChat deployment...${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Create backup before deployment
print_status "Creating backup..."
mkdir -p $BACKUP_DIR
if [ -d "$APP_DIR" ]; then
    tar -czf $BACKUP_DIR/pre_deploy_$(date +%Y%m%d_%H%M%S).tar.gz $APP_DIR 2>/dev/null || true
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
fi

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    print_status "Installing Nginx..."
    sudo apt install nginx -y
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

# Create application directory
print_status "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# If this is a fresh deployment, you'll need to clone your repository
if [ ! -d "$APP_DIR/.git" ]; then
    print_warning "No git repository found. Please clone your repository to $APP_DIR"
    print_warning "Run: git clone https://github.com/yourusername/RandomChat.git $APP_DIR"
    exit 1
fi

# Navigate to app directory
cd $APP_DIR

# Pull latest changes
print_status "Pulling latest changes..."
git pull origin main

# Install server dependencies
print_status "Installing server dependencies..."
cd server
npm install --production

# Install client dependencies
print_status "Installing client dependencies..."
cd ../client
npm install

# Build the React client
print_status "Building React client..."
npm run build

# Create logs directory
cd ..
mkdir -p logs

# Set proper permissions
print_status "Setting permissions..."
sudo chown -R $USER:$USER $APP_DIR
sudo chmod -R 755 $APP_DIR

# Stop existing PM2 process if running
if pm2 list | grep -q "randomchat-server"; then
    print_status "Stopping existing PM2 process..."
    pm2 stop randomchat-server || true
    pm2 delete randomchat-server || true
fi

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
print_status "Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/randomchat
sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/randomchat

# Enable the site
sudo ln -sf /etc/nginx/sites-available/randomchat /etc/nginx/sites-enabled/

# Remove default nginx site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
    sudo systemctl reload nginx
else
    print_error "Nginx configuration is invalid"
    exit 1
fi

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Create backup script
print_status "Setting up backup script..."
cat > /var/www/backup.sh << 'EOF'
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
EOF

chmod +x /var/www/backup.sh

# Add backup to crontab if not already present
if ! crontab -l 2>/dev/null | grep -q "backup.sh"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * /var/www/backup.sh") | crontab -
fi

# Check if application is running
sleep 5
if pm2 list | grep -q "randomchat-server.*online"; then
    print_status "Application is running successfully!"
else
    print_error "Application failed to start. Check logs with: pm2 logs randomchat-server"
    exit 1
fi

# Display useful information
echo -e "${BLUE}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}📊 Useful commands:${NC}"
echo -e "  View logs: ${YELLOW}pm2 logs randomchat-server${NC}"
echo -e "  Monitor: ${YELLOW}pm2 monit${NC}"
echo -e "  Restart: ${YELLOW}pm2 restart randomchat-server${NC}"
echo -e "  Nginx logs: ${YELLOW}sudo tail -f /var/log/nginx/error.log${NC}"
echo -e "  Backup: ${YELLOW}/var/www/backup.sh${NC}"
echo -e ""
echo -e "${GREEN}🌐 Your application should be accessible at:${NC}"
echo -e "  http://$DOMAIN"
echo -e "  https://$DOMAIN (after SSL setup)"
echo -e ""
echo -e "${YELLOW}🔒 Don't forget to:${NC}"
echo -e "  1. Set up SSL certificate with: ${BLUE}sudo certbot --nginx -d $DOMAIN${NC}"
echo -e "  2. Update your domain DNS to point to this server"
echo -e "  3. Configure environment variables in server/.env"
echo -e "  4. Set up monitoring and alerts" 