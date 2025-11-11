# Migration: Fix Project Links Schema

## Issue
The Prisma schema defined `links` as `String[]` but the application was trying to store JSON objects with structure `{ id, name, url }`. This caused project creation to fail.

## Changes
- Changed `links` column type from `String[]` to `Json` (JSONB in PostgreSQL)
- This allows storing array of objects as expected by the frontend

## How to Apply

**IMPORTANT**: Migrations are in `.gitignore`, so you need to generate this migration locally.

### Option 1: Using Prisma Migrate (Recommended)
Since the schema.prisma file has been updated, simply run:

```bash
npm run prisma:migrate
```

This will detect the schema changes and create a new migration automatically.

When prompted for a migration name, use: `fix_project_links`

### Option 2: Manual SQL Migration
If you want to apply the migration manually without Prisma, run this SQL:

```sql
-- AlterTable: Change links column from String[] to Json
-- This fixes project creation issue where links are stored as JSON objects
ALTER TABLE "projects" ALTER COLUMN "links" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "links" TYPE JSONB USING 
  CASE 
    WHEN "links" IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("links")
  END;
ALTER TABLE "projects" ALTER COLUMN "links" SET DEFAULT '[]'::jsonb;
```

Apply with:
```bash
psql -U postgres -d taskmanager -f migration.sql
```

### Option 3: Fresh Database (Development Only)
If this is a development environment with no important data:

```bash
npm run prisma:migrate -- reset
npm run prisma:generate
npm run prisma:seed
```

⚠️ **WARNING**: This will delete ALL data in your database!

## After Migration
Don't forget to regenerate the Prisma client:

```bash
npm run prisma:generate
```

## Testing
After migration, test project creation with links to ensure it works correctly:

1. Create a new project
2. Add links in the project modal
3. Save the project
4. Verify project is created successfully
5. Check that links are saved and displayed correctly

## Troubleshooting

### Error: "column links cannot be cast automatically"
If you see this error, you need to handle existing data. Run this instead:

```sql
-- First, convert existing array data to JSON
ALTER TABLE "projects" ALTER COLUMN "links" TYPE JSONB USING 
  CASE 
    WHEN "links" IS NULL THEN NULL
    WHEN array_length("links", 1) IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("links")
  END;
```

### Migration already applied
If you've already applied this migration, you can skip it. Check with:

```bash
npm run prisma:migrate -- status
```

