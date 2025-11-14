# Telegram Integration - Database Migration Instructions

## Migration Required

Before using the Telegram bot functionality, you need to run the Prisma migration:

```bash
npx prisma migrate dev --name add_telegram_integration
```

This will create the necessary database schema changes:

### User Table Changes
- Added `telegramChatId` (String?, unique) - Telegram Chat ID for sending messages
- Added `telegramUsername` (String?) - Username in Telegram  
- Added `telegramLinkedAt` (DateTime?) - When the account was linked

### New Table: telegram_link_tokens
- `id` (String, UUID, primary key)
- `token` (String, unique) - Link code in format LINK-XXXXXX
- `userId` (String, unique, foreign key to users.id)
- `expiresAt` (DateTime) - Token expiration (15 minutes from creation)
- `createdAt` (DateTime)

## Verification

After running the migration, verify with:

```bash
npx prisma studio
```

Check that:
1. `users` table has the new Telegram fields
2. `telegram_link_tokens` table exists

## Prisma Client Generation

The Prisma client has already been generated with the new types. If you need to regenerate:

```bash
npx prisma generate
```

## Environment Setup

Ensure your `.env` file has the Telegram bot token:

```
TELEGRAM_BOT_TOKEN=8339141997:AAE0cslPkVtmJIzxe34azKC8TIfy2VaGams
```

## Testing the Migration

1. Start the database (if using Docker):
   ```bash
   npm run docker:up
   ```

2. Run the migration:
   ```bash
   npx prisma migrate dev --name add_telegram_integration
   ```

3. Verify tables were created correctly

4. Start the server:
   ```bash
   npm run dev:server
   ```

5. Check that the Telegram bot initializes (you should see "🤖 Telegram bot initialized successfully" in the logs)
