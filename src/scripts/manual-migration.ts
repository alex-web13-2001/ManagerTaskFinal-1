import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting manual migration for Board sharing features...');

  try {
    // Check if column exists or add it
    console.log('Attempting to add "isPublic" column...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boards' AND column_name='isPublic') THEN 
          ALTER TABLE "boards" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false; 
          RAISE NOTICE 'Added isPublic column';
        ELSE
          RAISE NOTICE 'isPublic column already exists';
        END IF; 
      END $$;
    `);
    console.log('Confirmed "isPublic" column.');
  } catch (e: any) {
    console.warn('Error handling "isPublic" (safe to ignore if exists):', e.message);
  }

  try {
    console.log('Attempting to add "publicToken" column...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boards' AND column_name='publicToken') THEN 
          ALTER TABLE "boards" ADD COLUMN "publicToken" TEXT; 
          CREATE UNIQUE INDEX "boards_publicToken_key" ON "boards"("publicToken");
          RAISE NOTICE 'Added publicToken column and index';
        ELSE
          RAISE NOTICE 'publicToken column already exists';
        END IF; 
      END $$;
    `);
    console.log('Confirmed "publicToken" column.');
  } catch (e: any) {
    console.warn('Error handling "publicToken":', e.message);
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
