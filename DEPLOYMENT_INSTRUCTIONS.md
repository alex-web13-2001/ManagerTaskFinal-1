# Инструкции по развертыванию после исправления API URL

## Что было исправлено ✅

Изменены hardcoded URL `http://localhost:3001` на относительные пути во frontend коде:

### Измененные файлы:
1. `src/utils/api-client.tsx` - основной API клиент
2. `src/contexts/app-context.tsx` - контекст приложения (4 вхождения)
3. `src/components/invite-accept-page.tsx` - страница принятия приглашений

### Что изменилось:
```javascript
// Было:
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Стало:
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

## Как это работает

### Локальная разработка:
1. Создайте файл `.env` в корне проекта
2. Добавьте: `VITE_API_BASE_URL="http://localhost:3001"`
3. Запустите `npm run dev`
4. Frontend будет делать запросы к `http://localhost:3001/api/*`

### Production (на сервере):
1. **НЕ создавайте** файл `.env` или оставьте `VITE_API_BASE_URL` пустым
2. Соберите frontend: `npm run build`
3. Frontend будет делать запросы к относительным путям: `/api/*`
4. Nginx автоматически проксирует эти запросы на `http://127.0.0.1:3001/api`

## Шаги развертывания на сервере

### 1. Обновите код на сервере:
```bash
cd /path/to/Managertaskfin1
git pull origin copilot/fix-nginx-proxy-issues-again
```

### 2. Пересоберите frontend:
```bash
npm install
npm run build
```

### 3. Скопируйте build в nginx директорию:
```bash
# Бэкап старой версии (опционально)
sudo mv /var/www/kanban.24task.ru /var/www/kanban.24task.ru.backup

# Копируем новую сборку
sudo cp -r build /var/www/kanban.24task.ru
sudo chown -R www-data:www-data /var/www/kanban.24task.ru
```

### 4. Проверьте, что backend работает:
```bash
pm2 status
# Должно показать: kanban-taskmanager-api | online

# Проверьте прямой доступ к backend:
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kanban.24task.ru","password":"Admin123!"}'
```

### 5. Перезагрузите nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Проверьте работу через браузер:
1. Откройте https://kanban.24task.ru
2. Очистите кэш браузера (Ctrl+Shift+R или Cmd+Shift+R)
3. Попробуйте войти с email и паролем
4. Откройте DevTools (F12) → Network tab
5. Проверьте, что запросы идут на `/api/auth/signin` (относительный путь)
6. Статус должен быть 200 OK, а не CONNECTION_REFUSED

## Проверка через DevTools

### Правильное поведение:
```
Request URL: https://kanban.24task.ru/api/auth/signin
Request Method: POST
Status Code: 200 OK
```

### Неправильное поведение (если проблема не исправлена):
```
Request URL: http://localhost:3001/api/auth/signin
Status: (failed) net::ERR_CONNECTION_REFUSED
```

## Возможные проблемы

### Проблема: Браузер все еще показывает CONNECTION_REFUSED
**Решение:**
1. Очистите кэш браузера полностью (Ctrl+Shift+Delete)
2. Используйте режим инкогнито для теста
3. Проверьте, что загружается новый файл JS (должен быть `index-D7m5LzlL.js`)

### Проблема: 404 Not Found на /api/auth/signin
**Решение:**
1. Проверьте конфигурацию Nginx
2. Убедитесь, что backend запущен на порту 3001
3. Проверьте логи: `sudo tail -f /var/log/nginx/error.log`

### Проблема: CORS ошибки
**Решение:**
1. Относительные пути не должны вызывать CORS ошибок
2. Если есть, проверьте настройки backend CORS middleware

## Тестирование

### Тест 1: Login через браузер
```
1. Откройте https://kanban.24task.ru
2. Введите: admin@kanban.24task.ru / Admin123!
3. Нажмите "Войти"
4. Должны войти без ошибок
```

### Тест 2: Проверка через curl
```bash
# Тест напрямую к backend
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kanban.24task.ru","password":"Admin123!"}'

# Тест через Nginx
curl -X POST https://kanban.24task.ru/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kanban.24task.ru","password":"Admin123!"}'

# Оба должны вернуть JWT токен
```

### Тест 3: Проверка других API endpoints
```bash
# Health check
curl https://kanban.24task.ru/api/health

# Получить текущего пользователя (с токеном)
curl https://kanban.24task.ru/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Важные примечания

1. ✅ **Backend роуты НЕ имеют префикса `/api`** - они определены как `/auth/signin`, `/auth/me` и т.д.
2. ✅ **Nginx добавляет префикс `/api`** при проксировании: `location /api` → `proxy_pass http://127.0.0.1:3001/api`
3. ✅ **Frontend теперь делает запросы с `/api`** - использует относительные пути
4. ✅ **Для разработки используйте .env файл** с `VITE_API_BASE_URL="http://localhost:3001"`
5. ✅ **Для production НЕ используйте .env** или оставьте переменную пустой

## Поддержка

Если возникли проблемы:
1. Проверьте логи backend: `pm2 logs kanban-taskmanager-api`
2. Проверьте логи Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Проверьте DevTools Console в браузере на наличие ошибок
4. Проверьте DevTools Network tab чтобы увидеть точные URLs запросов
