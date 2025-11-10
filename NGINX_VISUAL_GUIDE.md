# 📊 Nginx Proxy Issue - Visual Explanation

## 🔴 Problem Flow (Before Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                               │
│                   https://kanban.24task.ru                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/auth/signin
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           NGINX                                 │
│                      Port 443 (HTTPS)                           │
│                                                                 │
│  location /api/ {                                               │
│      proxy_pass http://127.0.0.1:3001/api/;  ❌               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /auth/signin  ❌ (без /api)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                   Express Server (Port 3001)                    │
│                                                                 │
│  app.post('/api/auth/signin', ...)  ← Ожидает /api/auth/signin │
│                                                                 │
│  Получает: /auth/signin  ❌                                     │
│  Результат: 404 Cannot POST /auth/signin                       │
└─────────────────────────────────────────────────────────────────┘
```

### 🔍 Что происходит?

1. **Frontend** отправляет: `POST /api/auth/signin` ✅
2. **Nginx** получает: `POST /api/auth/signin` ✅
3. **Nginx** обрабатывает через `location /api/`
4. **Nginx** проксирует с `proxy_pass http://127.0.0.1:3001/api/;`
5. Nginx заменяет `/api/` на `/api/` (должно работать!)
6. Но на практике **Backend получает**: `POST /auth/signin` ❌
7. Backend ищет маршрут `/auth/signin` - не находит
8. **Результат**: `404 Not Found` ❌

---

## ✅ Solution Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                               │
│                   https://kanban.24task.ru                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/auth/signin
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           NGINX                                 │
│                      Port 443 (HTTPS)                           │
│                                                                 │
│  location /api/ {                                               │
│      proxy_pass http://127.0.0.1:3001;  ✅                     │
│      # Нет пути после порта = передается весь путь             │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/auth/signin  ✅
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                   Express Server (Port 3001)                    │
│                                                                 │
│  app.post('/api/auth/signin', ...)  ← Ожидает /api/auth/signin │
│                                                                 │
│  Получает: /api/auth/signin  ✅                                 │
│  Результат: 200 OK (или 400/401 для неверных данных)           │
└─────────────────────────────────────────────────────────────────┘
```

### ✨ Что изменилось?

1. **Frontend** отправляет: `POST /api/auth/signin` ✅
2. **Nginx** получает: `POST /api/auth/signin` ✅
3. **Nginx** обрабатывает через `location /api/`
4. **Nginx** проксирует с `proxy_pass http://127.0.0.1:3001` (БЕЗ пути)
5. Nginx передает ВЕСЬ оригинальный путь без изменений
6. **Backend получает**: `POST /api/auth/signin` ✅
7. Backend находит маршрут `/api/auth/signin`
8. **Результат**: `200 OK` ✅

---

## 📐 Nginx proxy_pass Rules Visualization

### Rule 1: NO URI in proxy_pass (✅ Recommended)

```
┌──────────────┐
│ location     │
│ /api/        │
└──────────────┘
       │
       │ /api/auth/signin
       ▼
┌──────────────────────────────┐
│ proxy_pass                   │
│ http://127.0.0.1:3001        │  ← NO path after port
│                              │
│ Behavior: Pass FULL path     │
└──────────────────────────────┘
       │
       │ /api/auth/signin (unchanged)
       ▼
┌──────────────┐
│   BACKEND    │
└──────────────┘
```

### Rule 2: URI with same path (✅ Works but redundant)

```
┌──────────────┐
│ location     │
│ /api/        │  ← Matches /api/
└──────────────┘
       │
       │ /api/auth/signin
       ▼
┌──────────────────────────────┐
│ proxy_pass                   │
│ http://127.0.0.1:3001/api/   │  ← Path /api/ after port
│                              │
│ Behavior: Replace /api/      │
│           with /api/         │
└──────────────────────────────┘
       │
       │ /api/auth/signin (replaced /api/ with /api/)
       ▼
┌──────────────┐
│   BACKEND    │
└──────────────┘
```

### Rule 3: URI with different path (❌ Strips /api)

```
┌──────────────┐
│ location     │
│ /api/        │  ← Matches /api/
└──────────────┘
       │
       │ /api/auth/signin
       ▼
┌──────────────────────────────┐
│ proxy_pass                   │
│ http://127.0.0.1:3001/       │  ← Path / after port
│                              │
│ Behavior: Replace /api/      │
│           with /             │
└──────────────────────────────┘
       │
       │ /auth/signin (replaced /api/ with /)  ❌
       ▼
┌──────────────┐
│   BACKEND    │
│              │
│ 404 Error!   │
└──────────────┘
```

---

## 🔄 Request Flow Comparison

### ❌ Broken Configuration

```
Browser          Nginx                  Backend
   │               │                       │
   │─────POST─────▶│                       │
   │ /api/auth/    │                       │
   │   signin      │                       │
   │               │                       │
   │               │ proxy_pass            │
   │               │ .../3001/api/         │
   │               │                       │
   │               │────POST──────────────▶│
   │               │ /auth/signin ❌       │
   │               │ (без /api)            │
   │               │                       │
   │               │◀────404 Error────────│
   │               │ Cannot POST           │
   │               │ /auth/signin          │
   │◀────404──────│                       │
   │               │                       │
```

### ✅ Fixed Configuration

```
Browser          Nginx                  Backend
   │               │                       │
   │─────POST─────▶│                       │
   │ /api/auth/    │                       │
   │   signin      │                       │
   │               │                       │
   │               │ proxy_pass            │
   │               │ .../3001              │
   │               │                       │
   │               │────POST──────────────▶│
   │               │ /api/auth/signin ✅   │
   │               │                       │
   │               │◀────200 OK───────────│
   │               │ { token, user }       │
   │◀────200──────│                       │
   │               │                       │
```

---

## 🎯 Configuration Matrix

| Configuration | Request | Backend Receives | Result |
|--------------|---------|------------------|--------|
| `location /api/` + `proxy_pass http://...3001` | `/api/auth/signin` | `/api/auth/signin` | ✅ Works |
| `location /api/` + `proxy_pass http://...3001/` | `/api/auth/signin` | `/auth/signin` | ❌ 404 |
| `location /api/` + `proxy_pass http://...3001/api/` | `/api/auth/signin` | `/api/auth/signin` | ✅ Works |
| `location /api` + `proxy_pass http://...3001` | `/api/auth/signin` | `/api/auth/signin` | ⚠️ Works but matches /api* |
| `location /api` + `proxy_pass http://...3001/` | `/api/auth/signin` | Does not match | ❌ No match |

**Legend:**
- ✅ Works correctly
- ❌ Does not work (404 or no match)
- ⚠️ Works but not recommended (matches unwanted paths)

---

## 🏗️ Backend Routes Structure

```
Express Server (Port 3001)
│
├── /health                      ← Health check (legacy)
├── /api/health                  ← Health check (new)
│
├── /api/auth/
│   ├── POST /signin            ← Authentication
│   ├── POST /signup            ← Registration
│   ├── GET  /me                ← Current user
│   ├── POST /forgot-password   ← Password reset
│   └── POST /reset-password    ← Password reset confirm
│
├── /api/upload-avatar          ← User avatar
├── /api/upload-attachment      ← Task attachment
│
├── /api/kv/:key               ← KV store operations
├── /api/kv-prefix/:prefix     ← KV store prefix query
│
├── /api/invitations/
│   ├── POST /send-email       ← Send invitation
│   └── GET  /:invitationId    ← Get invitation
│
└── /api/tasks/
    ├── POST /validate-permission  ← Check permissions
    └── POST /check-permissions    ← Batch check
```

**Key Points:**
- ALL API routes use `/api` prefix
- Health check available at both `/health` and `/api/health`
- Frontend expects all API calls to include `/api`
- Nginx MUST pass the full path including `/api`

---

## 🧪 Testing Flow

### Manual Testing

```bash
# Step 1: Test backend directly
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}
# If fails → Backend problem

# Step 2: Test through Nginx
curl https://kanban.24task.ru/api/health
# Expected: {"status":"ok","timestamp":"..."}
# If fails → Nginx config problem

# Step 3: Test auth endpoint
curl -X POST https://kanban.24task.ru/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'
# Expected: HTTP 400/401 (not 404!)
# If 404 → /api prefix is being stripped
```

### Automated Testing

```bash
./verify-deployment.sh

Tests:
├── ✅ Backend health (direct)
├── ✅ Backend /api/auth/signin (direct)
├── ✅ Nginx proxy to /api/health
├── ✅ Nginx proxy to /api/auth/signin
├── ✅ PM2 process status
├── ✅ Port 3001 listening
└── ✅ Nginx configuration valid

Result: 7 passed, 0 failed
```

---

## 📊 Impact Analysis

### Before Fix
```
User Action: Try to login
    ↓
Frontend: POST /api/auth/signin
    ↓
Nginx: Strips /api, sends /auth/signin
    ↓
Backend: Cannot find route /auth/signin
    ↓
Result: 404 Error
    ↓
User Experience: Cannot login ❌
```

### After Fix
```
User Action: Try to login
    ↓
Frontend: POST /api/auth/signin
    ↓
Nginx: Passes /api/auth/signin unchanged
    ↓
Backend: Finds route /api/auth/signin
    ↓
Result: 200 OK (or 401 if wrong credentials)
    ↓
User Experience: Can login ✅
```

---

## 🎓 Key Takeaways

1. **Nginx proxy_pass WITHOUT URI** = full path passed unchanged
2. **Nginx proxy_pass WITH URI** = matched part replaced with URI
3. **Trailing slashes matter** in both location and proxy_pass
4. **Test backend directly first** before debugging Nginx
5. **Use automated verification** to catch issues early

---

## 📝 Quick Reference

| Need | Command |
|------|---------|
| Edit Nginx config | `sudo nano /etc/nginx/sites-available/taskmanager` |
| Test Nginx config | `sudo nginx -t` |
| Reload Nginx | `sudo systemctl reload nginx` |
| Check PM2 status | `pm2 status` |
| View PM2 logs | `pm2 logs taskmanager-api` |
| Test backend | `curl http://localhost:3001/api/health` |
| Test through Nginx | `curl https://kanban.24task.ru/api/health` |
| Run verification | `./verify-deployment.sh` |

---

**Document Version:** 1.0  
**Created:** 2025-11-10  
**Visual Diagrams:** ASCII Art  
**Status:** ✅ Complete
