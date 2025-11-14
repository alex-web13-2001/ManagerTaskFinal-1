# Telegram Bot Integration - Testing Guide

## Prerequisites

1. Database is running and migration has been applied
2. Server is running with `npm run dev:server`
3. You have access to the Telegram bot @T24_robot

## Test Scenarios

### 1. Test Database Migration

**Steps:**
```bash
# Run migration
npx prisma migrate dev --name add_telegram_integration

# Verify with Prisma Studio
npx prisma studio
```

**Expected Result:**
- ✅ `users` table has new fields: `telegramChatId`, `telegramUsername`, `telegramLinkedAt`
- ✅ `telegram_link_tokens` table exists with all fields

---

### 2. Test Telegram Bot Commands

**Steps:**
1. Open Telegram
2. Search for @T24_robot
3. Send `/start`

**Expected Result:**
```
👋 Привет! Я T24 Бот - твой помощник по задачам.

🔗 Для подключения:
1. Зайди в веб-приложение T24
2. Нажми на кнопку "Т24 Бот"
3. Скопируй код подключения
4. Отправь его мне

✉️ Используй команду /help для справки
```

**Steps:**
4. Send `/help`

**Expected Result:**
```
📚 Доступные команды:

/start - Начать работу с ботом
/link - Получить инструкцию по подключению
/unlink - Отвязать аккаунт
/help - Показать эту справку
```

---

### 3. Test Account Linking Flow

**Steps:**
1. Login to the web application
2. Click on "Т24 Бот" button in the header (next to "Новая задача")
3. Modal should open showing:
   - Instructions
   - Link code (format: LINK-XXXXXX)
   - "Открыть @T24_robot" button
   - Expiration time

**Expected Result:**
- ✅ Modal opens without errors
- ✅ Link code is displayed (6 characters after LINK-)
- ✅ Copy button works
- ✅ Expiration time is shown (15 minutes from generation)

**Steps:**
4. Copy the link code
5. Go to Telegram @T24_robot
6. Send the link code (e.g., LINK-A3F9D2)

**Expected Result:**
```
✅ Аккаунт успешно привязан!

👤 Пользователь: [Your Name]
📧 Email: [your@email.com]

Теперь вы будете получать уведомления о назначенных задачах.
```

**Steps:**
7. Refresh the web modal

**Expected Result:**
- ✅ Modal now shows "Telegram подключен" status
- ✅ Shows connected username
- ✅ Shows "Открыть бота" and "Отвязать" buttons

---

### 4. Test Invalid/Expired Codes

**Test 4.1: Invalid Code**

**Steps:**
1. In Telegram, send `LINK-INVALID`

**Expected Result:**
```
❌ Неверный код. Проверьте правильность ввода.
```

**Test 4.2: Expired Code**

**Steps:**
1. Generate a link code in the web app
2. Wait 15+ minutes
3. Try to use the code in Telegram

**Expected Result:**
```
⏰ Код истёк. Получите новый код в веб-приложении.
```

---

### 5. Test Task Assignment Notification

**Test 5.1: New Task Assignment**

**Steps:**
1. Ensure your Telegram account is linked
2. Have another user create a task and assign it to you
   - OR create a second account, link it, and assign a task from the first account

**Expected Result:**
Telegram notification received:
```
🟡 Вам назначена новая задача!

📋 [Task Title]
📝 [Task Description (truncated if >100 chars)]

📁 Проект: [Project Name]
👤 От: [Assigner Name]
⏰ Приоритет: medium

🔗 Открыть: http://localhost:5173/tasks
```

**Test 5.2: Task Reassignment**

**Steps:**
1. Have a task reassigned to you (change assignee from someone else to you)

**Expected Result:**
- ✅ Telegram notification received
- ✅ Notification shows correct task details

**Test 5.3: Self-Assignment (No Notification)**

**Steps:**
1. Create a task and assign it to yourself

**Expected Result:**
- ✅ No Telegram notification (you don't notify yourself)

**Test 5.4: Unlinked Account (No Notification)**

**Steps:**
1. Unlink your Telegram account
2. Have someone assign a task to you

**Expected Result:**
- ✅ No Telegram notification
- ✅ Server logs: "ℹ️  User {userId} has no Telegram linked, skipping notification"

---

### 6. Test Priority Emojis

Create tasks with different priorities and verify emojis:

| Priority | Emoji | Expected |
|----------|-------|----------|
| low      | 🟢    | Green circle |
| medium   | 🟡    | Yellow circle |
| high     | 🔴    | Red circle |
| urgent   | 🚨    | Siren |

---

### 7. Test Unlink Flow

**Steps:**
1. Link Telegram account
2. In Telegram, send `/unlink`

**Expected Result:**
```
✅ Аккаунт успешно отвязан.
```

**Steps:**
3. Check web application modal

**Expected Result:**
- ✅ Modal shows unlinked status
- ✅ New link code is generated

**Alternative: Unlink from Web**

**Steps:**
1. Open Telegram modal in web app
2. Click "Отвязать" button

**Expected Result:**
- ✅ Account unlinked
- ✅ Toast notification shown
- ✅ Modal updates to show unlinked status

---

### 8. Test API Endpoints

**Test 8.1: GET /api/telegram/status**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/telegram/status
```

**Expected Response:**
```json
{
  "linked": true,
  "username": "your_username",
  "linkedAt": "2025-11-13T23:45:00.000Z"
}
```

**Test 8.2: POST /api/telegram/generate-link-token**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/telegram/generate-link-token
```

**Expected Response (if not linked):**
```json
{
  "linked": false,
  "token": "LINK-A3F9D2",
  "expiresAt": "2025-11-13T23:59:00.000Z"
}
```

**Expected Response (if already linked):**
```json
{
  "linked": true,
  "username": "your_username"
}
```

**Test 8.3: POST /api/telegram/unlink**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/telegram/unlink
```

**Expected Response:**
```json
{
  "success": true
}
```

---

## Edge Cases to Test

### 1. Multiple Link Attempts
- Generate link code
- Generate another link code
- First code should be invalidated

### 2. Concurrent Linking
- Two users trying to use same code
- Only first should succeed

### 3. Bot Restart
- Link account
- Restart server
- Notifications should still work

### 4. Long Descriptions
- Create task with >100 character description
- Notification should truncate with "..."

### 5. Missing Bot Token
- Remove TELEGRAM_BOT_TOKEN from .env
- Server should start with warning
- No errors when assigning tasks

---

## Troubleshooting

### Bot doesn't respond
- Check server logs for "🤖 Telegram bot initialized"
- Verify TELEGRAM_BOT_TOKEN is correct
- Check if bot is running with `pm2 list` or process manager

### Notifications not received
- Check user has telegramChatId in database
- Check server logs for "📤 Telegram notification sent"
- Verify task was assigned to someone else (not self)

### Link code doesn't work
- Check token hasn't expired (15 min limit)
- Verify token exists in database
- Check format is exactly LINK-XXXXXX

### TypeScript errors
- Run `npx prisma generate` to regenerate client
- Check @types/node-telegram-bot-api is installed

---

## Success Criteria

All tests pass when:
- ✅ Database migration applied successfully
- ✅ Bot responds to all commands
- ✅ Account linking works end-to-end
- ✅ Invalid/expired codes are rejected
- ✅ Notifications delivered for task assignments
- ✅ No notifications for self-assignments
- ✅ Unlink works from both Telegram and web
- ✅ API endpoints return correct data
- ✅ No security vulnerabilities detected
- ✅ TypeScript compiles without errors in main code
