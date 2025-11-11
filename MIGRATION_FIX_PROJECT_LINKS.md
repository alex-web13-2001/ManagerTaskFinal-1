# Migration: Fix Project Links Schema

## Issue
The Prisma schema defined `links` as `String[]` but the application was trying to store JSON objects with structure `{ id, name, url }`. This caused project creation to fail.

## Changes
- Changed `links` column type from `String[]` to `Json` (JSONB in PostgreSQL)
- This allows storing array of objects as expected by the frontend

## How to Apply

### Option 1: Using Prisma Migrate (Recommended)
```bash
npm run prisma:migrate
```

### Option 2: Manual Migration
If you encounter issues with Prisma migrate, you can apply the SQL directly:

```bash
psql -U postgres -d taskmanager -f prisma/migrations/20251111202115_fix_project_links/migration.sql
```

### Option 3: Fresh Database
If this is a development environment with no important data:
```bash
npm run prisma:migrate -- reset
npm run prisma:generate
npm run prisma:seed
```

## After Migration
Don't forget to regenerate the Prisma client:
```bash
npm run prisma:generate
```

## Testing
After migration, test project creation with links to ensure it works correctly.
