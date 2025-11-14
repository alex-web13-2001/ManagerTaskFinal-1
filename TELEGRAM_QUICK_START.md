# Telegram Bot Integration - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Database Migration
```bash
npx prisma migrate dev --name add_telegram_integration
```

### Step 3: Configure Bot Token
Add to your `.env` file:
```env
TELEGRAM_BOT_TOKEN=8339141997:AAE0cslPkVtmJIzxe34azKC8TIfy2VaGams
```

### Step 4: Start Server
```bash
npm run dev:server
```

You should see:
```
🚀 Server running on http://localhost:3001
🔌 WebSocket server ready
🤖 Telegram bot initialized successfully
```

### Step 5: Test Linking
1. Open web app → Click "Т24 Бот" button
2. Copy the link code (LINK-XXXXXX)
3. Open Telegram → Search @T24_robot
4. Send `/start`, then send your link code
5. ✅ Account linked!

---

## 📱 User Experience

### Web Interface
```
┌────────────────────────────────────────────────────────┐
│ [Logo] [Dashboard] [Projects]    [New Task] [💬 T24 Bot] [🔔] [👤] │
└────────────────────────────────────────────────────────┘
                                              ↑
                                           Click here
                                              ↓
┌──────────────────────────────────────────────┐
│  Подключить Telegram бота              [✕]   │
├──────────────────────────────────────────────┤
│  Получайте уведомления о назначенных         │
│  задачах прямо в Telegram!                   │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Инструкция:                            │ │
│  │ 1. Откройте бота в Telegram            │ │
│  │ 2. Нажмите /start                      │ │
│  │ 3. Отправьте код подключения боту      │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Код подключения:                            │
│  ┌──────────────────┐ ┌──┐                  │
│  │   LINK-A3F9D2    │ │📋│                  │
│  └──────────────────┘ └──┘                  │
│  Код действителен до: 14:35:00               │
│                                              │
│  [ Открыть @T24_robot ]                     │
└──────────────────────────────────────────────┘
```

### Telegram Bot
```
┌──────────────────────────────────────┐
│  T24 Bot                        🤖   │
├──────────────────────────────────────┤
│                                      │
│  You: /start                         │
│                                      │
│  Bot:                                │
│  👋 Привет! Я T24 Бот - твой         │
│  помощник по задачам.                │
│                                      │
│  🔗 Для подключения:                 │
│  1. Зайди в веб-приложение T24       │
│  2. Нажми на кнопку "Т24 Бот"        │
│  3. Скопируй код подключения         │
│  4. Отправь его мне                  │
│                                      │
│  ✉️ Используй команду /help          │
│  для справки                         │
│                                      │
│  You: LINK-A3F9D2                    │
│                                      │
│  Bot:                                │
│  ✅ Аккаунт успешно привязан!        │
│                                      │
│  👤 Пользователь: Иван Иванов        │
│  📧 Email: ivan@example.com          │
│                                      │
│  Теперь вы будете получать           │
│  уведомления о назначенных задачах.  │
│                                      │
└──────────────────────────────────────┘
```

### Notification Example
```
┌──────────────────────────────────────┐
│  T24 Bot                        🤖   │
├──────────────────────────────────────┤
│                                      │
│  🔴 Вам назначена новая задача!      │
│                                      │
│  📋 Исправить критический баг        │
│  📝 Приложение падает при входе.     │
│  Срочно исправить...                 │
│                                      │
│  📁 Проект: Mobile App               │
│  👤 От: Анна Петрова                 │
│  ⏰ Приоритет: high                  │
│                                      │
│  🔗 Открыть: http://localhost:5173/tasks │
│                                      │
└──────────────────────────────────────┘
```

---

## 🎨 Priority Emojis

| Priority | Emoji | Color  |
|----------|-------|--------|
| Low      | 🟢    | Green  |
| Medium   | 🟡    | Yellow |
| High     | 🔴    | Red    |
| Urgent   | 🚨    | Alert  |

---

## 🔑 Bot Commands

| Command  | Description                        |
|----------|------------------------------------|
| /start   | Welcome message & instructions     |
| /help    | List all available commands        |
| /link    | Get linking instructions           |
| /unlink  | Disconnect Telegram account        |

---

## 🛠️ API Endpoints

### Generate Link Token
```bash
POST /api/telegram/generate-link-token
Authorization: Bearer {token}

Response:
{
  "linked": false,
  "token": "LINK-A3F9D2",
  "expiresAt": "2025-11-14T00:00:00Z"
}
```

### Check Status
```bash
GET /api/telegram/status
Authorization: Bearer {token}

Response:
{
  "linked": true,
  "username": "ivan_ivanov",
  "linkedAt": "2025-11-13T23:45:00Z"
}
```

### Unlink Account
```bash
POST /api/telegram/unlink
Authorization: Bearer {token}

Response:
{
  "success": true
}
```

---

## 📊 Database Schema

```sql
-- User table (existing, modified)
ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN telegram_username VARCHAR;
ALTER TABLE users ADD COLUMN telegram_linked_at TIMESTAMP;

-- New table for link tokens
CREATE TABLE telegram_link_tokens (
  id UUID PRIMARY KEY,
  token VARCHAR UNIQUE,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_telegram_link_tokens_token ON telegram_link_tokens(token);
```

---

## ✅ Testing Checklist

- [ ] Bot responds to /start command
- [ ] Bot responds to /help command
- [ ] Link code generates successfully
- [ ] Link code can be copied
- [ ] Link code expires after 15 minutes
- [ ] Account links successfully in Telegram
- [ ] Web UI updates to show linked status
- [ ] Notification received on task assignment
- [ ] Notification shows correct task details
- [ ] Priority emoji shows correctly
- [ ] Unlink works from Telegram (/unlink)
- [ ] Unlink works from web UI
- [ ] Invalid codes are rejected
- [ ] Expired codes are rejected
- [ ] No notification on self-assignment

---

## 🐛 Troubleshooting

### Bot doesn't initialize
**Problem:** Server starts but bot doesn't respond  
**Solution:** 
- Check TELEGRAM_BOT_TOKEN in .env
- Verify token is correct (starts with number:)
- Check server logs for initialization message

### Can't link account
**Problem:** Code doesn't work in Telegram  
**Solution:**
- Check code format is LINK-XXXXXX (6 chars after hyphen)
- Verify code hasn't expired (15 min limit)
- Generate new code if expired

### No notifications received
**Problem:** Task assigned but no Telegram message  
**Solution:**
- Verify account is linked (check web UI)
- Confirm task was assigned to you, not self-assigned
- Check server logs for notification attempt
- Verify bot is running (check process manager)

### TypeScript errors
**Problem:** Compilation fails  
**Solution:**
```bash
npx prisma generate
npm install
```

---

## 📚 Documentation

- **TELEGRAM_IMPLEMENTATION_SUMMARY.md** - Complete overview
- **TELEGRAM_MIGRATION_GUIDE.md** - Database migration steps
- **TELEGRAM_TESTING_GUIDE.md** - Detailed test scenarios

---

## 🎯 MVP Features

✅ **Core Features Delivered:**
- User authentication in bot
- Task assignment notifications
- Account linking/unlinking
- Web UI integration
- Error handling
- Security measures

🔮 **Future Enhancements (Not in MVP):**
- Status change notifications
- Comment notifications
- Task creation via bot
- /mytasks command
- /today command
- Notification preferences

---

## 🎉 Success Indicators

You'll know it's working when:
1. ✅ Server logs show bot initialized
2. ✅ Bot responds to /start in Telegram
3. ✅ Link code appears in web modal
4. ✅ Account links successfully
5. ✅ Notification arrives when task assigned
6. ✅ Notification contains correct task info

---

## 💡 Tips

- **Use descriptive task titles** - They appear in notifications
- **Set priority correctly** - Emojis help identify urgent tasks
- **Link early** - Link account before tasks get assigned
- **Check status** - Use web UI to verify connection
- **Unlink/relink** - If issues, try unlinking and relinking

---

## 🚀 You're Ready!

The Telegram bot integration is fully functional. Just:
1. Run migration
2. Add bot token
3. Start server
4. Link accounts
5. Enjoy notifications! 🎉
