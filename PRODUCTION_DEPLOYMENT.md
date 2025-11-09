# 🚀 Production Deployment Guide

Complete guide for deploying the Task Manager application to production server with PostgreSQL, Prisma, and Express API.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Merge to Main Branch](#merge-to-main-branch)
3. [Server Requirements](#server-requirements)
4. [Initial Server Setup](#initial-server-setup)
5. [Database Setup](#database-setup)
6. [Application Installation](#application-installation)
7. [Environment Configuration](#environment-configuration)
8. [SSL Certificate Setup](#ssl-certificate-setup)
9. [Nginx Configuration](#nginx-configuration)
10. [PM2 Process Manager](#pm2-process-manager)
11. [Email Configuration](#email-configuration)
12. [Security Hardening](#security-hardening)
13. [Monitoring & Logs](#monitoring--logs)
14. [Backup Strategy](#backup-strategy)
15. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Ubuntu 20.04+ or CentOS 8+ server
- ✅ Root or sudo access
- ✅ Domain name pointed to your server IP
- ✅ SMTP credentials (Gmail, SendGrid, AWS SES, etc.)
- ✅ At least 2GB RAM and 20GB disk space

---

## Merge to Main Branch

### Step 1: Review the Pull Request

Go to GitHub and review:
```
https://github.com/alex-web13-2001/Managertaskfin1/pull/[PR_NUMBER]
```

### Step 2: Merge via GitHub UI

**Option A: GitHub Web Interface (Recommended)**
1. Navigate to the Pull Request
2. Click "Merge pull request"
3. Select "Create a merge commit" or "Squash and merge"
4. Click "Confirm merge"
5. Optionally delete the branch `copilot/migratesupabase-to-prisma`

**Option B: Command Line**
```bash
# Clone repository
git clone https://github.com/alex-web13-2001/Managertaskfin1.git
cd Managertaskfin1

# Checkout main branch
git checkout main
git pull origin main

# Merge the PR branch
git merge copilot/migratesupabase-to-prisma

# Push to main
git push origin main

# Delete feature branch (optional)
git push origin --delete copilot/migratesupabase-to-prisma
```

---

## Server Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 2GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+, CentOS 8+, Debian 11+

### Recommended for Production
- **CPU**: 4+ cores
- **RAM**: 4GB+
- **Storage**: 50GB+ SSD
- **Bandwidth**: 100Mbps+

---

## Initial Server Setup

### 1. Update System

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2. Install Required Packages

```bash
# Ubuntu/Debian
sudo apt install -y curl git build-essential

# CentOS/RHEL
sudo yum install -y curl git gcc-c++ make
```

### 3. Install Node.js 18+

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x or higher
npm --version   # Should be 9.x or higher
```

### 4. Install PostgreSQL 15

```bash
# Ubuntu/Debian
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify
sudo systemctl status postgresql
```

### 5. Install Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Allow through firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Database Setup

### 1. Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL console:
CREATE DATABASE taskmanager;
CREATE USER taskmanager_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager_user;
\q
```

### 2. Configure PostgreSQL for Remote Access (if needed)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Change:
listen_addresses = 'localhost'

# Edit pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add (only if accessing from specific IP):
host    taskmanager    taskmanager_user    YOUR_APP_SERVER_IP/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 3. Test Database Connection

```bash
psql -h localhost -U taskmanager_user -d taskmanager
# Enter password when prompted
# If successful, you'll see: taskmanager=>
\q
```

---

## Application Installation

### 1. Create Application User

```bash
# Create user without login shell for security
sudo useradd -r -s /bin/false taskmanager

# Create application directory
sudo mkdir -p /var/www/taskmanager
sudo chown -R $USER:$USER /var/www/taskmanager
```

### 2. Clone Repository

```bash
cd /var/www/taskmanager

# Clone from main branch
git clone https://github.com/alex-web13-2001/Managertaskfin1.git .

# Checkout main branch (after merge)
git checkout main
git pull origin main
```

### 3. Install Dependencies

```bash
# Install Node.js dependencies
npm install --production

# Install Prisma CLI globally (optional)
sudo npm install -g prisma
```

### 4. Create Upload Directory

```bash
# Create uploads directory
mkdir -p /var/www/taskmanager/uploads

# Set permissions
chmod 755 /var/www/taskmanager/uploads
```

---

## Environment Configuration

### 1. Create Production Environment File

```bash
cd /var/www/taskmanager
cp .env.example .env
nano .env
```

### 2. Configure Environment Variables

```env
# Database Configuration
DATABASE_URL="postgresql://taskmanager_user:your_secure_password_here@localhost:5432/taskmanager?schema=public"

# JWT Configuration
JWT_SECRET="generate_a_strong_random_secret_here_min_32_chars"

# Application URL
VITE_API_BASE_URL="https://yourdomain.com"
APP_URL="https://yourdomain.com"

# Email Configuration (Gmail example)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-gmail-app-password"
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_FROM_NAME="Task Manager"

# Admin Seed Credentials
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="change_this_secure_password"
ADMIN_NAME="Administrator"

# Node Environment
NODE_ENV="production"
PORT=3001
```

### 3. Generate Strong Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate secure admin password
openssl rand -base64 16
```

---

## SSL Certificate Setup

### Option 1: Let's Encrypt (Free, Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### Option 2: Existing Certificate

```bash
# Copy your certificate files
sudo cp your_certificate.crt /etc/ssl/certs/
sudo cp your_private_key.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/your_private_key.key
```

---

## Nginx Configuration

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/taskmanager
```

### 2. Add Configuration

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/taskmanager_access.log;
    error_log /var/log/nginx/taskmanager_error.log;

    # Frontend (React/Vite)
    location / {
        root /var/www/taskmanager/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Uploads
    location /uploads {
        alias /var/www/taskmanager/uploads;
        expires 1y;
        add_header Cache-Control "public";
        
        # Security: prevent execution
        location ~ \.(php|exe|sh)$ {
            deny all;
        }
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ /.env {
        deny all;
    }

    # Max upload size
    client_max_body_size 10M;
}
```

### 3. Enable Site and Test

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Build Application

### 1. Run Prisma Migrations

```bash
cd /var/www/taskmanager

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database with admin user
npx ts-node prisma/seed.ts
```

### 2. Build Frontend

```bash
# Build Vite application
npm run build

# Verify dist folder created
ls -la dist/
```

---

## PM2 Process Manager

### 1. Install PM2

```bash
sudo npm install -g pm2
```

### 2. Create PM2 Ecosystem File

```bash
nano /var/www/taskmanager/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'taskmanager-api',
    script: 'src/server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader ts-node/esm',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/taskmanager-error.log',
    out_file: '/var/log/pm2/taskmanager-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

### 3. Start Application with PM2

```bash
# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Start application
cd /var/www/taskmanager
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command that PM2 outputs

# Check status
pm2 status
pm2 logs taskmanager-api
```

### 4. PM2 Useful Commands

```bash
# View logs
pm2 logs taskmanager-api
pm2 logs taskmanager-api --lines 100

# Restart application
pm2 restart taskmanager-api

# Stop application
pm2 stop taskmanager-api

# Monitor resources
pm2 monit

# List processes
pm2 list
```

---

## Email Configuration

### Gmail Setup

1. **Enable 2-Factor Authentication**
   - Go to Google Account settings
   - Security → 2-Step Verification

2. **Generate App Password**
   - Security → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
   - Use in `.env` as `EMAIL_PASSWORD`

### SendGrid Setup

```env
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_PORT=587
EMAIL_USER="apikey"
EMAIL_PASSWORD="your_sendgrid_api_key"
```

### AWS SES Setup

```env
EMAIL_HOST="email-smtp.us-east-1.amazonaws.com"
EMAIL_PORT=587
EMAIL_USER="your_aws_access_key"
EMAIL_PASSWORD="your_aws_secret_key"
```

### Test Email

```bash
# Test email sending
curl -X POST https://yourdomain.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## Security Hardening

### 1. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable

# Check status
sudo ufw status verbose
```

### 2. Fail2Ban (Prevent Brute Force)

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/*error.log
```

```bash
# Start Fail2Ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config

# Change:
PermitRootLogin no
PasswordAuthentication no  # Use SSH keys only

sudo systemctl restart sshd
```

### 4. Set File Permissions

```bash
cd /var/www/taskmanager

# Secure .env file
chmod 600 .env

# Secure application files
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;

# Make scripts executable
chmod +x node_modules/.bin/*

# Secure uploads directory
chmod 755 uploads/
```

### 5. Rate Limiting

Already configured in Nginx, but consider adding to Express:

```bash
npm install express-rate-limit
```

---

## Monitoring & Logs

### 1. Application Logs

```bash
# PM2 logs
pm2 logs taskmanager-api

# Nginx logs
sudo tail -f /var/log/nginx/taskmanager_access.log
sudo tail -f /var/log/nginx/taskmanager_error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### 2. System Monitoring

```bash
# CPU and Memory usage
pm2 monit

# Disk usage
df -h

# Network connections
netstat -tuln | grep LISTEN
```

### 3. Health Checks

```bash
# Application health
curl https://yourdomain.com/health

# Database connection
psql -h localhost -U taskmanager_user -d taskmanager -c "SELECT 1;"
```

### 4. Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/taskmanager
```

```
/var/log/pm2/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0640 $USER $USER
}

/var/log/nginx/taskmanager*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

---

## Backup Strategy

### 1. Database Backup Script

```bash
sudo nano /usr/local/bin/backup-taskmanager.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/taskmanager"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="taskmanager"
DB_USER="taskmanager_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz /var/www/taskmanager/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-taskmanager.sh

# Test backup
sudo /usr/local/bin/backup-taskmanager.sh
```

### 2. Schedule Automatic Backups

```bash
# Edit crontab
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-taskmanager.sh >> /var/log/taskmanager-backup.log 2>&1
```

### 3. Restore from Backup

```bash
# Restore database
gunzip -c /var/backups/taskmanager/db_backup_YYYYMMDD_HHMMSS.sql.gz | \
  psql -U taskmanager_user -d taskmanager

# Restore uploads
tar -xzf /var/backups/taskmanager/uploads_backup_YYYYMMDD_HHMMSS.tar.gz -C /
```

---

## Deployment Workflow

### For Future Updates

```bash
# 1. Pull latest changes
cd /var/www/taskmanager
git pull origin main

# 2. Install new dependencies
npm install --production

# 3. Run new migrations
npx prisma migrate deploy
npx prisma generate

# 4. Rebuild frontend
npm run build

# 5. Restart backend
pm2 restart taskmanager-api

# 6. Reload Nginx (if config changed)
sudo nginx -t && sudo systemctl reload nginx

# 7. Verify deployment
curl https://yourdomain.com/health
pm2 logs taskmanager-api --lines 50
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs taskmanager-api --lines 100

# Check if port is in use
sudo lsof -i :3001

# Check environment variables
pm2 env 0

# Restart with fresh config
pm2 delete taskmanager-api
pm2 start ecosystem.config.js
```

### Database Connection Issues

```bash
# Test connection
psql -h localhost -U taskmanager_user -d taskmanager

# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Email Not Sending

```bash
# Check SMTP configuration
cat .env | grep EMAIL

# Test with curl
curl -X POST https://yourdomain.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'

# Check application logs
pm2 logs taskmanager-api | grep -i email
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/taskmanager_error.log

# Test backend directly
curl http://localhost:3001/health

# Check port binding
sudo netstat -tuln | grep 3001
```

### SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test SSL configuration
sudo nginx -t

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -noout -dates
```

### High Memory Usage

```bash
# Check PM2 processes
pm2 monit

# Restart with memory limit
pm2 restart taskmanager-api --max-memory-restart 500M

# Check for memory leaks in logs
pm2 logs taskmanager-api | grep -i "memory\|heap"
```

---

## Performance Optimization

### 1. Enable Gzip Compression

Already configured in Nginx config above.

### 2. Database Optimization

```sql
-- Connect to database
psql -U taskmanager_user -d taskmanager

-- Add indexes for common queries
CREATE INDEX idx_kvstore_key ON "KvStore"(key);
CREATE INDEX idx_user_email ON "User"(email);

-- Analyze tables
ANALYZE "User";
ANALYZE "KvStore";

-- Check database size
SELECT pg_size_pretty(pg_database_size('taskmanager'));
```

### 3. CDN for Static Assets

Consider using Cloudflare or AWS CloudFront for:
- Frontend assets (JS, CSS, images)
- Uploaded files

### 4. Redis Caching (Optional)

For high-traffic scenarios, add Redis:

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

---

## Post-Deployment Checklist

- [ ] Application accessible via HTTPS
- [ ] SSL certificate valid and auto-renewing
- [ ] Database migrations applied successfully
- [ ] Admin user created (test login)
- [ ] Email notifications working
- [ ] File uploads working
- [ ] All API endpoints responding
- [ ] PM2 process running
- [ ] Nginx serving frontend correctly
- [ ] Firewall configured
- [ ] Fail2Ban active
- [ ] Backups scheduled
- [ ] Logs rotating correctly
- [ ] Monitoring in place
- [ ] DNS records correct
- [ ] Health check endpoint working

---

## Support & Resources

- **Documentation**: See other .md files in repository
- **Prisma Docs**: https://www.prisma.io/docs
- **Express Docs**: https://expressjs.com/
- **PM2 Docs**: https://pm2.keymetrics.io/
- **Nginx Docs**: https://nginx.org/en/docs/

---

## Security Contacts

**Important**: Never commit secrets to git. Use environment variables for:
- Database passwords
- JWT secrets
- API keys
- SMTP credentials

---

**Deployment Guide Version**: 1.0  
**Last Updated**: 2025-11-09  
**Application Version**: Post-Supabase Migration

🎉 **Congratulations! Your application is now deployed to production!**
