# 🔍 Server Update Visibility Guide

**Проблема**: Вы заливаете изменения на сервер, но не видите обновлений на продакшене.  
**Problem**: You upload changes to the server but don't see updates in production.

## 📊 Quick Diagnostic Checklist

Проверьте каждый пункт по порядку:

### ✅ Step 1: Verify Changes are Committed Locally
```bash
# Check if you have uncommitted changes
git status

# If you see files listed, commit them:
git add .
git commit -m "Description of changes"
```

### ✅ Step 2: Verify Changes are Pushed to GitHub
```bash
# Push changes to remote
git push origin main

# Or if you're on a different branch:
git push origin <your-branch-name>

# Verify push was successful - check the output for "Everything up-to-date"
# or confirmation that changes were pushed
```

### ✅ Step 3: Verify on GitHub Web Interface
1. Go to https://github.com/alex-web13-2001/Managertaskfin1
2. Navigate to the branch you pushed to
3. Check that your latest commits are visible
4. Note the commit hash (first 7 characters)

### ✅ Step 4: Pull Changes on Server
**На вашем сервере (On your server):**

```bash
# Navigate to application directory
cd /var/www/taskmanager  # or your app directory

# Check current git status
git status
git branch  # Verify you're on the correct branch

# Pull latest changes
git pull origin main

# Verify the commit hash matches what you saw on GitHub
git log --oneline -5
```

### ✅ Step 5: Install New Dependencies (if package.json changed)
```bash
# Install any new dependencies
npm install --production
```

### ✅ Step 6: Run Database Migrations (if database schema changed)
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### ✅ Step 7: Rebuild Frontend
```bash
# Build the frontend application
npm run build

# Verify dist folder was updated
ls -la dist/
```

### ✅ Step 8: Restart Backend Server
```bash
# If using PM2:
pm2 restart taskmanager-api
pm2 logs taskmanager-api --lines 50

# If using systemd:
sudo systemctl restart taskmanager

# If running directly with npm:
# Stop the current process (Ctrl+C) and run:
npm run dev:server
```

### ✅ Step 9: Clear Browser Cache
```bash
# In your browser:
# 1. Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) to hard refresh
# 2. Or clear browser cache completely
# 3. Or open in incognito/private mode
```

### ✅ Step 10: Verify Changes are Live
```bash
# Check the application health
curl https://yourdomain.com/health

# Check frontend loads
curl -I https://yourdomain.com

# Check if timestamp of static files updated
curl -I https://yourdomain.com/assets/index-*.js
```

---

## 🔧 Common Problems and Solutions

### Problem 1: "Already up to date" but changes not visible

**Причина**: Вы находитесь на неправильной ветке на сервере.

**Solution:**
```bash
# Check which branch you're on
git branch

# If you're not on 'main', switch to it:
git checkout main
git pull origin main

# Then rebuild and restart (Steps 5-8)
```

### Problem 2: Changes visible in code but not in browser

**Причина**: Браузер показывает закешированную версию.

**Solution:**
```bash
# Clear browser cache completely
# Or open in incognito mode
# Or try from a different browser/device
```

### Problem 3: Backend changes not working

**Причина**: Сервер не был перезапущен после обновления кода.

**Solution:**
```bash
# Restart the backend server
pm2 restart taskmanager-api

# Check logs for errors
pm2 logs taskmanager-api --lines 100

# If errors, check environment variables
cat .env
```

### Problem 4: Frontend changes not visible

**Причина**: Frontend не был пересобран после изменений.

**Solution:**
```bash
# Rebuild frontend
npm run build

# Check that dist folder is updated
ls -lt dist/ | head -10

# Restart nginx to clear any cache
sudo systemctl reload nginx
```

### Problem 5: Database changes not applied

**Причина**: Миграции базы данных не были применены.

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Restart backend
pm2 restart taskmanager-api
```

### Problem 6: Permission errors

**Причина**: Файлы принадлежат другому пользователю.

**Solution:**
```bash
# Check file ownership
ls -la

# Fix ownership (replace 'youruser' with actual username)
sudo chown -R youruser:youruser /var/www/taskmanager

# Fix permissions
chmod -R 755 /var/www/taskmanager
chmod 600 /var/www/taskmanager/.env
```

---

## 🚀 Complete Update Workflow

Use this workflow every time you want to deploy changes:

```bash
# === ON YOUR LOCAL MACHINE ===

# 1. Make your changes
# (edit files as needed)

# 2. Commit changes
git add .
git commit -m "Describe your changes"

# 3. Push to GitHub
git push origin main

# 4. Verify on GitHub
# Go to https://github.com/alex-web13-2001/Managertaskfin1
# Verify your commit is there

# === ON YOUR SERVER ===

# 5. Navigate to app directory
cd /var/www/taskmanager

# 6. Pull changes
git pull origin main

# 7. Install dependencies (if needed)
npm install --production

# 8. Run migrations (if database changed)
npx prisma generate
npx prisma migrate deploy

# 9. Rebuild frontend
npm run build

# 10. Restart backend
pm2 restart taskmanager-api

# 11. Verify
pm2 logs taskmanager-api --lines 20
curl https://yourdomain.com/health

# === IN YOUR BROWSER ===

# 12. Hard refresh
# Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)
```

---

## 📱 Quick Commands Reference

### Check if changes are on GitHub
```bash
# View commits on GitHub
git log origin/main --oneline -5

# Compare local with remote
git diff main origin/main
```

### Check if server has latest code
```bash
# On server, check last commit
cd /var/www/taskmanager
git log --oneline -1

# Compare with GitHub (should match)
git fetch origin
git log origin/main --oneline -1
```

### Force clean state
```bash
# If nothing else works, reset to GitHub state
# WARNING: This will discard any local changes on server
cd /var/www/taskmanager
git fetch origin
git reset --hard origin/main
npm install --production
npm run build
pm2 restart taskmanager-api
```

---

## 🔍 Verification Commands

### Verify Frontend is Updated
```bash
# Check build timestamp
ls -lh dist/index.html

# Check JavaScript bundle hash (should change when code changes)
ls -lh dist/assets/*.js
```

### Verify Backend is Running New Code
```bash
# Check PM2 process uptime (should be recent if just restarted)
pm2 status

# Check logs for startup message with timestamp
pm2 logs taskmanager-api --lines 30
```

### Verify Database is Up to Date
```bash
# Check migration status
npx prisma migrate status

# Connect to database and check
psql -U taskmanager_user -d taskmanager -c "\dt"
```

---

## 📞 When to Ask for Help

Ask for help if:
1. ✅ You've followed all steps above
2. ✅ You've verified changes are on GitHub
3. ✅ You've pulled changes on server
4. ✅ You've rebuilt and restarted
5. ✅ You've cleared browser cache
6. ❌ Changes are still not visible

**Before asking:**
- Collect output of: `git log -1`, `pm2 logs`, `sudo tail -f /var/log/nginx/error.log`
- Note: Which specific changes are not visible?
- Note: Any error messages you see

---

## 🎯 Most Common Issue

**90% of the time**, the issue is one of these:

1. **Changes not pushed to GitHub** - Solution: `git push origin main`
2. **Server hasn't pulled changes** - Solution: `cd /var/www/taskmanager && git pull origin main`
3. **Frontend not rebuilt** - Solution: `npm run build`
4. **Backend not restarted** - Solution: `pm2 restart taskmanager-api`
5. **Browser cache** - Solution: Hard refresh (Ctrl+Shift+R)

**Start with these 5 checks first!**

---

## 📚 Related Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) - Full deployment setup
- [Quick Start Guide](src/QUICK_START.md) - Local development setup
- [README](README.md) - General project information

---

**Remember**: Always commit → push → pull → rebuild → restart → clear cache

This ensures changes flow from your local machine → GitHub → Server → Browser
