# 🔄 Deployment Flow Diagram / Схема Развёртывания

## Visual Flow / Визуальная Схема

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PIPELINE                                │
│              Процесс развёртывания изменений                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   LOCAL      │  1. Make Changes / Внести изменения
│   MACHINE    │  2. Test Locally / Протестировать локально
│              │
│  ┌────────┐  │  Commands:
│  │ Code   │  │    - Edit files
│  │Changes │  │    - npm run dev
│  └────────┘  │    - Test in browser
└──────┬───────┘
       │
       │ git add .
       │ git commit -m "..."
       │ 
       ▼
┌──────────────┐
│   GIT        │  3. Commit Changes / Закоммитить
│   LOCAL      │
│  ┌────────┐  │  Commands:
│  │Commits │  │    git status
│  │Staged  │  │    git add .
│  └────────┘  │    git commit -m "message"
└──────┬───────┘
       │
       │ git push origin main
       │
       ▼
┌──────────────┐
│   GITHUB     │  4. Push to GitHub / Отправить на GitHub
│   REMOTE     │
│  ┌────────┐  │  Verify:
│  │Remote  │  │    - Visit github.com
│  │Repo    │  │    - Check commits visible
│  └────────┘  │    - Note commit hash
└──────┬───────┘
       │
       │ SSH to server
       │ cd /var/www/taskmanager
       │
       ▼
┌──────────────┐
│   SERVER     │  5. Pull Changes / Скачать изменения
│   (LOCAL)    │
│  ┌────────┐  │  Commands:
│  │Pull    │  │    cd /var/www/taskmanager
│  │Changes │  │    git pull origin main
│  └────────┘  │    git log -1
└──────┬───────┘
       │
       │ Check what changed
       │
       ▼
┌──────────────┐
│  BUILD       │  6. Install & Build / Установить и собрать
│  PROCESS     │
│              │  If package.json changed:
│  ┌────────┐  │    npm install --production
│  │Install │  │
│  │ & Build│  │  If Prisma schema changed:
│  └────────┘  │    npx prisma generate
│              │    npx prisma migrate deploy
│              │
│              │  ALWAYS:
│              │    npm run build
└──────┬───────┘
       │
       │ Restart services
       │
       ▼
┌──────────────┐
│   BACKEND    │  7. Restart Backend / Перезапустить бэкенд
│   SERVER     │
│  ┌────────┐  │  Commands:
│  │PM2     │  │    pm2 restart taskmanager-api
│  │Restart │  │    pm2 logs taskmanager-api
│  └────────┘  │    pm2 status
└──────┬───────┘
       │
       │ Services running
       │
       ▼
┌──────────────┐
│   NGINX      │  8. Nginx Serves / Nginx обслуживает
│   WEB        │
│   SERVER     │  - Serves frontend from dist/
│  ┌────────┐  │  - Proxies API to backend
│  │Serving │  │  - Handles SSL/HTTPS
│  │Content │  │
│  └────────┘  │  Optional:
│              │    sudo systemctl reload nginx
└──────┬───────┘
       │
       │ HTTPS request
       │
       ▼
┌──────────────┐
│   BROWSER    │  9. Clear Cache / Очистить кэш
│   CLIENT     │
│  ┌────────┐  │  Actions:
│  │Load    │  │    - Ctrl+Shift+R (hard refresh)
│  │Updated │  │    - Clear cache
│  │App     │  │    - Open incognito
│  └────────┘  │    - Try different browser
└──────────────┘

✅ UPDATES NOW VISIBLE! / ОБНОВЛЕНИЯ ТЕПЕРЬ ВИДНЫ!
```

---

## Troubleshooting Each Step / Решение проблем на каждом этапе

### ❌ Step 1 Failed: Local Changes

**Problem**: Changes not saved or syntax errors

**Solution**:
```bash
# Save all files in your editor
# Check for errors:
npm run dev
# Open browser and test locally
```

---

### ❌ Step 2 Failed: Git Commit

**Problem**: Files not committed

**Check**:
```bash
git status  # Shows uncommitted files?
```

**Solution**:
```bash
git add .
git commit -m "Your message"
```

---

### ❌ Step 3 Failed: Git Push

**Problem**: Changes not pushed to GitHub

**Check**:
```bash
git log origin/main..HEAD  # Shows unpushed commits?
```

**Solution**:
```bash
git push origin main
```

---

### ❌ Step 4 Failed: GitHub Sync

**Problem**: Changes not visible on GitHub

**Check**:
- Visit https://github.com/alex-web13-2001/Managertaskfin1
- Look for your latest commit
- Check commit hash matches local: `git log -1`

**Solution**:
- Refresh GitHub page
- Check you're looking at correct branch
- Verify push was successful (no errors)

---

### ❌ Step 5 Failed: Server Pull

**Problem**: Server doesn't have latest code

**Check**:
```bash
# On server
cd /var/www/taskmanager
git log -1  # Compare with GitHub
git status  # Clean working tree?
```

**Solution**:
```bash
git pull origin main
# If conflicts:
git stash
git pull origin main
```

---

### ❌ Step 6 Failed: Build Process

**Problem**: Frontend not built or dependencies missing

**Check**:
```bash
# Check if dist exists and is recent
ls -lt dist/ | head -5

# Check if node_modules exists
ls -d node_modules
```

**Solution**:
```bash
# Install dependencies
npm install --production

# Prisma (if database changed)
npx prisma generate
npx prisma migrate deploy

# Build frontend
npm run build
```

---

### ❌ Step 7 Failed: Backend Restart

**Problem**: Backend running old code

**Check**:
```bash
pm2 status  # Check uptime
pm2 logs taskmanager-api  # Check for errors
```

**Solution**:
```bash
pm2 restart taskmanager-api
pm2 logs taskmanager-api --lines 30
```

---

### ❌ Step 8 Failed: Nginx

**Problem**: Nginx serving old files or misconfigured

**Check**:
```bash
sudo nginx -t  # Test config
sudo tail -f /var/log/nginx/taskmanager_error.log
```

**Solution**:
```bash
sudo systemctl reload nginx
# Or
sudo systemctl restart nginx
```

---

### ❌ Step 9 Failed: Browser Cache

**Problem**: Browser showing cached version

**Solution**:
1. **Hard Refresh**: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. **Clear Cache**: Browser settings → Clear browsing data
3. **Incognito Mode**: Open in private/incognito window
4. **Different Device**: Try from phone or different computer

---

## Quick Reference Matrix / Быстрая справка

| Changed | Need to Run | Why |
|---------|-------------|-----|
| **Frontend code** (src/) | `npm run build` + `pm2 restart` | Rebuild React app |
| **Backend code** (src/server/) | `pm2 restart taskmanager-api` | Reload Node.js code |
| **package.json** | `npm install --production` | Install new dependencies |
| **Prisma schema** | `npx prisma generate` + `npx prisma migrate deploy` | Update database |
| **.env** | `pm2 restart taskmanager-api` | Reload environment vars |
| **Nginx config** | `sudo systemctl reload nginx` | Apply new config |

---

## Verification Checklist / Контрольный список

Use this after each deployment:

```bash
# ✅ 1. Code is on GitHub
curl -s https://api.github.com/repos/alex-web13-2001/Managertaskfin1/commits/main | grep sha | head -1

# ✅ 2. Code is on server
cd /var/www/taskmanager && git log -1 --oneline

# ✅ 3. Dependencies installed
[ -d "node_modules" ] && echo "✓ node_modules exists"

# ✅ 4. Frontend built
[ -d "dist" ] && echo "✓ dist exists" && ls -lh dist/index.html

# ✅ 5. Backend running
pm2 status taskmanager-api

# ✅ 6. No errors
pm2 logs taskmanager-api --lines 10 --nostream

# ✅ 7. Health check passes
curl http://localhost:3001/health

# ✅ 8. Frontend accessible
curl -I https://yourdomain.com/

# ✅ 9. API accessible
curl -I https://yourdomain.com/api/health

# ✅ 10. Browser shows updates
# Open in incognito mode
```

---

## Automated Check / Автоматическая проверка

Instead of manual checks, run the automated script:

```bash
cd /var/www/taskmanager
bash check-deployment.sh
```

This script checks all steps automatically and tells you what's wrong!

---

## Common Patterns / Частые паттерны

### Pattern 1: Code-only change (no DB, no deps)
```bash
# On server
git pull origin main
npm run build
pm2 restart taskmanager-api
```

### Pattern 2: Database schema change
```bash
# On server
git pull origin main
npm install --production
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart taskmanager-api
```

### Pattern 3: New dependency
```bash
# On server
git pull origin main
npm install --production
npm run build
pm2 restart taskmanager-api
```

### Pattern 4: Emergency rollback
```bash
# On server
git log --oneline -5  # Find good commit
git reset --hard <commit-hash>
npm run build
pm2 restart taskmanager-api
```

---

## Remember / Запомните

The complete flow is:
```
Edit → Commit → Push → Pull → Build → Restart → Refresh
```

Skip any step = Changes not visible!

Пропустите любой шаг = Изменения не видны!

---

## Need Help? / Нужна помощь?

1. **Run diagnostic**: `bash check-deployment.sh`
2. **Read guide**: [QUICK_FIX_DEPLOYMENT_RU.md](QUICK_FIX_DEPLOYMENT_RU.md)
3. **Detailed help**: [SERVER_UPDATE_VISIBILITY_GUIDE.md](SERVER_UPDATE_VISIBILITY_GUIDE.md)

---

**This diagram is your deployment reference card!**  
**Эта диаграмма - ваша справочная карточка по развёртыванию!**

Print it, bookmark it, reference it every deployment! 📋
