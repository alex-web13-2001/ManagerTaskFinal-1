# 🔄 Before & After - Visual Comparison

## ❌ BEFORE (Problem)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  https://kanban.24task.ru (user opens site)                     │
│                                                                   │
│  Frontend Code:                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ const API_BASE_URL = 'http://localhost:3001'           │    │
│  │ fetch(`${API_BASE_URL}/api/auth/signin`)               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Actual Request:                                                 │
│  POST http://localhost:3001/api/auth/signin ❌                  │
│                          │                                        │
└──────────────────────────┼────────────────────────────────────────┘
                           │
                           ▼
                   ❌ CONNECTION REFUSED
                   (No server on localhost:3001 in browser)
```

### Why it failed:
- Frontend hardcoded `localhost:3001`
- Browser tried to connect to user's local machine
- No backend running on user's localhost
- Nginx proxy was never reached

---

## ✅ AFTER (Solution)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  https://kanban.24task.ru (user opens site)                     │
│                                                                   │
│  Frontend Code:                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ const API_BASE_URL = ''  // Empty string               │    │
│  │ fetch(`${API_BASE_URL}/api/auth/signin`)               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Actual Request (relative path):                                │
│  POST /api/auth/signin                                           │
│                          │                                        │
│  Browser converts to:    │                                        │
│  POST https://kanban.24task.ru/api/auth/signin ✅               │
│                          │                                        │
└──────────────────────────┼────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │         NGINX SERVER                  │
        │   https://kanban.24task.ru           │
        │                                       │
        │   location /api {                    │
        │     proxy_pass                       │
        │       http://127.0.0.1:3001/api      │
        │   }                                   │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │      BACKEND (Node.js + Express)     │
        │      localhost:3001                   │
        │                                       │
        │   POST /api/auth/signin               │
        │   ✅ Returns JWT Token                │
        └──────────────────────────────────────┘
```

### Why it works:
- Frontend uses relative path `/api/auth/signin`
- Browser automatically uses current domain
- Request goes to `https://kanban.24task.ru/api/auth/signin`
- Nginx receives and proxies to backend
- Backend processes and returns response

---

## 📊 Side-by-Side Comparison

| Aspect | Before ❌ | After ✅ |
|--------|-----------|----------|
| **API Base URL** | `'http://localhost:3001'` | `''` (empty) |
| **Request URL** | `http://localhost:3001/api/auth/signin` | `/api/auth/signin` |
| **Resolved URL** | User's localhost (doesn't exist) | `https://kanban.24task.ru/api/auth/signin` |
| **Goes through Nginx?** | No | Yes |
| **Reaches Backend?** | No | Yes |
| **Result** | CONNECTION_REFUSED | Success ✅ |

---

## 🔍 Code Changes Detail

### File: `src/utils/api-client.tsx`

```diff
- const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
+ const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

### File: `src/contexts/app-context.tsx` (4 occurrences)

```diff
- const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
+ const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

### File: `src/components/invite-accept-page.tsx`

```diff
- const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
+ const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

**Total: 6 lines changed** 🎯

---

## 🌐 Request Flow Explained

### Before Fix (Failed):
```
User clicks "Login"
  ↓
Frontend: fetch('http://localhost:3001/api/auth/signin')
  ↓
Browser tries to connect to localhost:3001
  ↓
❌ CONNECTION REFUSED (no server on user's machine)
```

### After Fix (Success):
```
User clicks "Login"
  ↓
Frontend: fetch('/api/auth/signin')  // Relative path
  ↓
Browser: "This is relative, use current domain"
  ↓
Browser: fetch('https://kanban.24task.ru/api/auth/signin')
  ↓
Nginx: "I handle /api, proxy to backend"
  ↓
Nginx: proxy to http://127.0.0.1:3001/api/auth/signin
  ↓
Backend: process auth, return JWT token
  ↓
✅ Success! User logged in
```

---

## 🎯 Key Takeaways

1. **Never hardcode localhost in frontend code** when deploying to production
2. **Use relative paths** to leverage the current domain
3. **Environment variables** for development (`.env` file)
4. **Empty fallback** for production (uses relative paths)
5. **Nginx handles the routing** to backend automatically

---

## 🧪 Testing Checklist

- [ ] Build frontend: `npm run build`
- [ ] Deploy to server
- [ ] Clear browser cache
- [ ] Open DevTools Network tab
- [ ] Try to login
- [ ] Verify request URL is `https://kanban.24task.ru/api/auth/signin` ✅
- [ ] Verify Status Code is `200 OK` ✅
- [ ] Verify no CONNECTION_REFUSED errors ✅

**If all checks pass → Problem solved! 🎉**
