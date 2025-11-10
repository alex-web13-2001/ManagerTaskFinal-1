# 🔧 Решение проблемы Nginx Proxy для /api роутов

## 📋 Описание проблемы

**Симптомы:**
- Frontend отправляет: `POST https://kanban.24task.ru/api/auth/signin` ✅
- Nginx получает: `POST /api/auth/signin` ✅
- Backend получает: `POST /auth/signin` ❌ (без `/api`)
- Результат: `404 Cannot POST /auth/signin`

**Причина:**
Неправильная конфигурация Nginx `proxy_pass` приводит к тому, что префикс `/api` удаляется при проксировании запроса к backend серверу.

---

## ✅ Правильная конфигурация Nginx

### Вариант 1: Рекомендуемый (простой и надежный)

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Объяснение:**
- `location /api/` - совпадает с путями, начинающимися с `/api/`
- `proxy_pass http://127.0.0.1:3001;` - **БЕЗ URI** (без пути после порта)
- Когда в `proxy_pass` нет URI, весь путь передается как есть
- Запрос `/api/auth/signin` → проксируется как `/api/auth/signin` ✅

### Вариант 2: Альтернативный (с явным /api/)

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Объяснение:**
- `location /api/` совпадает с `/api/`
- `proxy_pass http://127.0.0.1:3001/api/;` - **С URI** `/api/`
- Nginx заменяет совпавшую часть (`/api/`) на указанный URI (`/api/`)
- Запрос `/api/auth/signin` → совпадает `/api/` → заменяется на `/api/` → `/api/auth/signin` ✅

---

## ❌ Неправильные конфигурации

### ❌ Не работает #1

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/;
}
```

**Почему не работает:**
- Nginx заменяет `/api/` на `/`
- Запрос `/api/auth/signin` → проксируется как `/auth/signin` ❌

### ❌ Не работает #2

```nginx
location /api {
    proxy_pass http://127.0.0.1:3001;
}
```

**Почему не работает:**
- Совпадает с `/api` и `/apiXXX`
- Может привести к неожиданному поведению

### ❌ Не работает #3

```nginx
location /api {
    proxy_pass http://127.0.0.1:3001/;
}
```

**Почему не работает:**
- Совпадает с `/api`, но не с `/api/`
- Запрос `/api/auth/signin` не совпадает с location

---

## 🔍 Диагностика проблемы

### Шаг 1: Проверьте Backend напрямую

```bash
# Должен возвращать JWT токен
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'

# Должен вернуть {"status":"ok"}
curl http://localhost:3001/api/health
```

**Ожидаемый результат:**
- `/api/auth/signin` → возвращает токен ✅
- `/api/health` → возвращает `{"status":"ok"}` ✅

Если эти запросы НЕ работают, проблема в backend, а не в Nginx.

### Шаг 2: Проверьте логи Nginx

```bash
# Access log (показывает запросы, которые Nginx получает)
sudo tail -f /var/log/nginx/access.log

# Error log (показывает ошибки)
sudo tail -f /var/log/nginx/error.log
```

**Что искать в access.log:**
```
POST /api/auth/signin HTTP/1.1" 404
```
Если видите 404, значит backend не может найти роут.

### Шаг 3: Проверьте логи Backend (PM2)

```bash
# Показать логи PM2
pm2 logs taskmanager-api --lines 50

# Или напрямую из файла
tail -f /var/log/pm2/taskmanager-out.log
tail -f /var/log/pm2/taskmanager-error.log
```

**Что искать:**
```
POST /auth/signin  ← БЕЗ /api - проблема!
POST /api/auth/signin  ← С /api - правильно!
```

### Шаг 4: Проверьте конфигурацию Nginx

```bash
# Посмотреть активную конфигурацию
cat /etc/nginx/sites-enabled/taskmanager | grep -A 15 "location /api"

# Проверить синтаксис
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

---

## 🚀 Пошаговое исправление

### 1. Откройте конфигурацию Nginx

```bash
sudo nano /etc/nginx/sites-available/taskmanager
```

### 2. Найдите блок `location /api`

Найдите строки:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    ...
}
```

### 3. Замените на правильную конфигурацию (Вариант 1)

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**ВАЖНО:** Удалите `/api/` из `proxy_pass`, оставьте только `http://127.0.0.1:3001`

### 4. Проверьте синтаксис

```bash
sudo nginx -t
```

**Ожидаемый вывод:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 5. Перезагрузите Nginx

```bash
sudo systemctl reload nginx
```

### 6. Проверьте работу

```bash
# Через Frontend
curl -X POST https://kanban.24task.ru/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'
```

**Ожидаемый результат:**
```json
{
  "user": {
    "id": "...",
    "email": "admin@example.com",
    "name": "Administrator"
  },
  "token": "eyJhbGc..."
}
```

---

## 🔧 Дополнительные проверки

### Проверка Health Check

```bash
# Через Nginx
curl https://kanban.24task.ru/api/health
# Должен вернуть: {"status":"ok","timestamp":"..."}

# Напрямую к backend
curl http://localhost:3001/api/health
# Должен вернуть: {"status":"ok","timestamp":"..."}
```

### Проверка PM2 статуса

```bash
pm2 status
```

**Ожидаемый вывод:**
```
┌─────┬──────────────────┬─────────┬─────────┬─────────┐
│ id  │ name             │ mode    │ status  │ restart │
├─────┼──────────────────┼─────────┼─────────┼─────────┤
│ 0   │ taskmanager-api  │ cluster │ online  │ 0       │
└─────┴──────────────────┴─────────┴─────────┴─────────┘
```

Status должен быть **online**, restart должен быть **0** (или небольшое число).

### Проверка порта 3001

```bash
sudo netstat -tuln | grep 3001
# Должен показать: tcp  0  0 0.0.0.0:3001  0.0.0.0:*  LISTEN
```

---

## 🎯 Полная конфигурация Nginx (Reference)

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name kanban.24task.ru;
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name kanban.24task.ru;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/kanban.24task.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kanban.24task.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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

    # Backend API - ПРАВИЛЬНАЯ КОНФИГУРАЦИЯ
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
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
    location /uploads/ {
        alias /var/www/taskmanager/uploads/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Health check (optional, can go through /api/)
    location = /health {
        proxy_pass http://127.0.0.1:3001/api/health;
        access_log off;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }

    # Max upload size
    client_max_body_size 50M;
}
```

---

## 📝 Объяснение правил Nginx proxy_pass

### Правило 1: proxy_pass БЕЗ URI

```nginx
location /api/ {
    proxy_pass http://backend;  # ← Нет пути после backend
}
```

**Поведение:** Весь оригинальный URI передается как есть.

**Примеры:**
- `/api/auth/signin` → `http://backend/api/auth/signin`
- `/api/users/123` → `http://backend/api/users/123`

### Правило 2: proxy_pass С URI

```nginx
location /api/ {
    proxy_pass http://backend/v1/;  # ← Есть путь /v1/
}
```

**Поведение:** Совпавшая часть location заменяется на URI из proxy_pass.

**Примеры:**
- `/api/auth/signin` → совпадает `/api/` → заменяется на `/v1/` → `http://backend/v1/auth/signin`
- `/api/users/123` → совпадает `/api/` → заменяется на `/v1/` → `http://backend/v1/users/123`

### Правило 3: Trailing slashes важны!

```nginx
# Случай A: location БЕЗ slash, proxy_pass БЕЗ slash
location /api {
    proxy_pass http://backend;  # Работает, но совпадает с /api и /apiXXX
}

# Случай B: location С slash, proxy_pass БЕЗ slash
location /api/ {
    proxy_pass http://backend;  # ✅ РЕКОМЕНДУЕТСЯ - передает /api/...
}

# Случай C: location С slash, proxy_pass С slash (без пути)
location /api/ {
    proxy_pass http://backend/;  # ❌ Удаляет /api/ из пути!
}

# Случай D: location С slash, proxy_pass С путем
location /api/ {
    proxy_pass http://backend/api/;  # ✅ Работает - заменяет /api/ на /api/
}
```

---

## ❓ FAQ

### Q: Почему backend получает запросы без /api?

**A:** Это происходит когда используется конфигурация:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/;  # ← Trailing slash удаляет /api
}
```

### Q: Нужно ли менять код backend?

**A:** НЕТ! Backend routes правильные и должны оставаться с `/api` префиксом:
```typescript
app.post('/api/auth/signin', ...);
app.post('/api/auth/signup', ...);
app.get('/api/health', ...);
```

### Q: Какая конфигурация самая надежная?

**A:** Используйте:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;  # БЕЗ trailing slash
}
```

Это самый простой и понятный вариант.

### Q: Как проверить, что все работает?

**A:** Выполните эти команды:
```bash
# 1. Проверка backend напрямую
curl http://localhost:3001/api/health  # Должен вернуть {"status":"ok"}

# 2. Проверка через Nginx
curl https://kanban.24task.ru/api/health  # Должен вернуть {"status":"ok"}

# 3. Проверка аутентификации
curl -X POST https://kanban.24task.ru/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'
# Должен вернуть токен
```

Все три команды должны работать!

---

## 🎉 Итоговый чеклист

- [ ] Backend работает напрямую (`curl http://localhost:3001/api/health`)
- [ ] PM2 процесс в статусе `online`
- [ ] Nginx конфигурация использует `location /api/` с `proxy_pass http://127.0.0.1:3001`
- [ ] Nginx синтаксис проверен (`nginx -t`)
- [ ] Nginx перезагружен (`systemctl reload nginx`)
- [ ] Health check работает через Nginx (`curl https://kanban.24task.ru/api/health`)
- [ ] Аутентификация работает (`POST /api/auth/signin`)
- [ ] Логи backend показывают правильные пути с `/api`

---

**Версия:** 1.0  
**Дата:** 2025-11-10  
**Статус:** ✅ Проверено и готово к использованию
