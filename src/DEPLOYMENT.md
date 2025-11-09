# 🚀 Deployment Guide - Task Manager

Complete guide for deploying the Task Manager application with self-hosted Postgres and Prisma.

---

## 📋 Contents

1. [Local Development](#local-development)
2. [Production Deployment](#production-deployment)
3. [Database Management](#database-management)
4. [Environment Variables](#environment-variables)
5. [Troubleshooting](#troubleshooting)

---

## 1️⃣ Local Development

### Requirements

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Setup Steps

#### 1. Clone and Install

```bash
git clone <repository-url>
cd Managertaskfin1
npm install
```

#### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taskmanager?schema=public"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-secret-key-change-this-in-production"

# Admin user credentials
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
ADMIN_NAME="Admin User"

# API Configuration
PORT=3001
NODE_ENV=development

# Frontend Configuration
VITE_API_BASE_URL="http://localhost:3001"
```

#### 3. Start Database

```bash
# Start Postgres in Docker
npm run docker:up

# Verify it's running
docker ps
```

#### 4. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations to create tables
npm run prisma:migrate

# Seed the database with admin user
npm run prisma:seed
```

#### 5. Start Development Servers

```bash
# Option 1: Start both frontend and backend
npm run dev:all

# Option 2: Start separately
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend  
npm run dev
```

#### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

#### 7. Login

Use the admin credentials from your `.env` file:
- Email: admin@example.com
- Password: admin123

---

## 2️⃣ Production Deployment

### Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Node.js 18+
- PostgreSQL 15+
- Nginx (for reverse proxy)
- PM2 (for process management)
- Domain name with SSL certificate

### Production Setup

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

#### 2. PostgreSQL Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE taskmanager;
CREATE USER taskmanager_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager_user;
\q
```

#### 3. Application Deployment

```bash
# Clone repository
cd /var/www
sudo git clone <repository-url> taskmanager
cd taskmanager

# Set permissions
sudo chown -R $USER:$USER /var/www/taskmanager

# Install dependencies
npm install --production

# Create production .env file
nano .env
```

Production `.env`:

```env
DATABASE_URL="postgresql://taskmanager_user:your-secure-password@localhost:5432/taskmanager?schema=public"
JWT_SECRET="<generate-a-long-random-string>"
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="<secure-password>"
ADMIN_NAME="Admin"
PORT=3001
NODE_ENV=production
VITE_API_BASE_URL="https://api.yourdomain.com"
```

#### 4. Database Migration

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed admin user
npx ts-node-esm prisma/seed.ts
```

#### 5. Build Frontend

```bash
npm run build
```

#### 6. Start Backend with PM2

```bash
# Start the server
pm2 start src/server/index.ts --name taskmanager-api --interpreter ts-node-esm

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command that PM2 outputs
```

#### 7. Configure Nginx

Create `/etc/nginx/sites-available/taskmanager`:

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    root /var/www/taskmanager/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 8. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal is configured automatically
```

---

## 3️⃣ Database Management

### Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration in development
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Seed the database
npx ts-node-esm prisma/seed.ts

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (CAREFUL! Deletes all data)
npx prisma migrate reset
```

### Database Backups

```bash
# Backup database
pg_dump -U taskmanager_user -h localhost taskmanager > backup_$(date +%Y%m%d).sql

# Restore database
psql -U taskmanager_user -h localhost taskmanager < backup_20231209.sql
```

### Creating New Migrations

1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description_of_changes`
3. Commit both the schema file and the migration files
4. On production, run `npx prisma migrate deploy`

---

## 4️⃣ Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Secret for JWT token signing | Random 64+ char string |
| `ADMIN_EMAIL` | Initial admin email | `admin@example.com` |
| `ADMIN_PASSWORD` | Initial admin password | Secure password |
| `ADMIN_NAME` | Initial admin name | `Admin User` |
| `PORT` | Backend API port | `3001` |
| `NODE_ENV` | Environment | `development` or `production` |
| `VITE_API_BASE_URL` | Frontend API URL | `http://localhost:3001` |

### Generating Secure JWT_SECRET

```bash
# Using OpenSSL
openssl rand -base64 64

# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## 5️⃣ Troubleshooting

### Problem: Port 3001 already in use

```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Problem: Database connection failed

```bash
# Check if Postgres is running
docker ps  # For Docker
sudo systemctl status postgresql  # For system installation

# Test connection
psql -U postgres -h localhost -d taskmanager

# Check DATABASE_URL format
echo $DATABASE_URL
```

### Problem: Prisma Client errors

```bash
# Regenerate Prisma Client
rm -rf node_modules/.prisma
npx prisma generate
```

### Problem: Migration failures

```bash
# Check migration status
npx prisma migrate status

# Resolve failed migrations
npx prisma migrate resolve --applied <migration-name>

# Reset and re-run (CAUTION: Deletes data)
npx prisma migrate reset
npx prisma migrate dev
```

### Problem: PM2 not starting

```bash
# Check logs
pm2 logs taskmanager-api

# Restart
pm2 restart taskmanager-api

# Check status
pm2 status
```

### Problem: File uploads failing

```bash
# Check uploads directory exists and is writable
ls -la uploads/
chmod 755 uploads/

# Check disk space
df -h
```

### Checking Logs

```bash
# Backend logs (PM2)
pm2 logs taskmanager-api

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# Status
pm2 status

# Detailed info
pm2 show taskmanager-api

# Real-time monitoring
pm2 monit
```

### Database Health

```bash
# Connect to database
psql -U taskmanager_user -h localhost taskmanager

# Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔄 Updating the Application

```bash
# Pull latest changes
cd /var/www/taskmanager
git pull origin main

# Install new dependencies
npm install

# Run migrations
npx prisma generate
npx prisma migrate deploy

# Rebuild frontend
npm run build

# Restart backend
pm2 restart taskmanager-api

# Clear Nginx cache if needed
sudo systemctl restart nginx
```

---

## 🎉 Success!

Your Task Manager application is now deployed and running!

**Important URLs:**
- Frontend: `https://yourdomain.com`
- Backend API: `https://api.yourdomain.com`
- Health Check: `https://api.yourdomain.com/health`

**Next Steps:**
- Set up monitoring and alerts
- Configure automated backups
- Review security settings
- Update admin credentials

---

**Need help?** Create an [issue on GitHub](https://github.com/yourusername/taskmanager/issues)
