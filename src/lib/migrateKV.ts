/**
 * Migration script to migrate custom columns and categories from KV store to Prisma models
 */

import prisma from '../server/db';
import * as kv from '../server/kv_store';

/**
 * Migrate custom columns from KV store to Prisma for a specific user
 */
async function migrateUserCustomColumns(userId: string): Promise<void> {
  console.log(`Migrating custom columns for user ${userId}...`);
  
  try {
    // Get custom columns from KV store
    const kvColumns = await kv.get(`custom_columns:${userId}`);
    
    if (!kvColumns || !Array.isArray(kvColumns) || kvColumns.length === 0) {
      console.log(`  No custom columns found in KV store for user ${userId}`);
      return;
    }

    // Check if columns already exist in Prisma
    const existingColumns = await prisma.customColumn.findMany({
      where: { userId },
    });

    if (existingColumns.length > 0) {
      console.log(`  User ${userId} already has ${existingColumns.length} custom columns in Prisma, skipping...`);
      return;
    }

    // Create custom columns in Prisma
    await prisma.customColumn.createMany({
      data: kvColumns.map((col: any, index: number) => ({
        id: col.id,
        name: col.name,
        color: col.color || null,
        order: col.order !== undefined ? col.order : index,
        userId,
      })),
    });

    console.log(`  ✅ Migrated ${kvColumns.length} custom columns for user ${userId}`);

    // Optionally delete from KV store after successful migration
    // await kv.del(`custom_columns:${userId}`);
  } catch (error) {
    console.error(`  ❌ Failed to migrate custom columns for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Migrate categories from KV store to Prisma for a specific user
 */
async function migrateUserCategories(userId: string): Promise<void> {
  console.log(`Migrating categories for user ${userId}...`);
  
  try {
    // Get categories from KV store
    const kvCategories = await kv.get(`categories:${userId}`);
    
    if (!kvCategories || !Array.isArray(kvCategories) || kvCategories.length === 0) {
      console.log(`  No categories found in KV store for user ${userId}`);
      return;
    }

    // Check if categories already exist in Prisma
    const existingCategories = await prisma.category.findMany({
      where: { userId },
    });

    if (existingCategories.length > 0) {
      console.log(`  User ${userId} already has ${existingCategories.length} categories in Prisma, skipping...`);
      return;
    }

    // Create categories in Prisma
    await prisma.category.createMany({
      data: kvCategories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color || '#3b82f6',
        userId,
      })),
      skipDuplicates: true, // Skip if duplicate userId+name
    });

    console.log(`  ✅ Migrated ${kvCategories.length} categories for user ${userId}`);

    // Optionally delete from KV store after successful migration
    // await kv.del(`categories:${userId}`);
  } catch (error) {
    console.error(`  ❌ Failed to migrate categories for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Migrate all custom columns and categories data for a user
 */
async function migrateUserKVData(userId: string): Promise<void> {
  console.log(`\n========== Migrating KV data for user ${userId} ==========\n`);
  
  await migrateUserCustomColumns(userId);
  await migrateUserCategories(userId);
  
  console.log(`\n========== KV migration completed for user ${userId} ==========\n`);
}

/**
 * Migrate all users' custom columns and categories data
 */
async function migrateAllKVData(): Promise<void> {
  console.log('\n========== Starting KV data migration ==========\n');
  
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    
    console.log(`Found ${users.length} users to migrate`);
    
    for (const user of users) {
      console.log(`\nMigrating KV data for ${user.email}...`);
      try {
        await migrateUserKVData(user.id);
      } catch (error) {
        console.error(`Failed to migrate KV data for user ${user.email}:`, error);
        // Continue with other users
      }
    }
    
    console.log('\n========== KV migration completed ==========\n');
  } catch (error) {
    console.error('❌ KV migration failed:', error);
    throw error;
  }
}

/**
 * Clean up KV store after successful migration
 */
async function cleanupKVStore(): Promise<void> {
  console.log('\n========== Cleaning up KV store ==========\n');
  
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    
    for (const user of users) {
      try {
        // Delete custom columns from KV store
        await kv.del(`custom_columns:${user.id}`);
        console.log(`  ✅ Deleted custom_columns:${user.id} from KV store`);
      } catch (error) {
        // Ignore errors
      }

      try {
        // Delete categories from KV store
        await kv.del(`categories:${user.id}`);
        console.log(`  ✅ Deleted categories:${user.id} from KV store`);
      } catch (error) {
        // Ignore errors
      }
    }
    
    console.log('\n========== KV cleanup completed ==========\n');
  } catch (error) {
    console.error('❌ KV cleanup failed:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const userId = process.argv[3];
  
  (async () => {
    try {
      switch (command) {
        case 'user':
          if (!userId) {
            console.error('Usage: npm run migrate:kv user <userId>');
            process.exit(1);
          }
          await migrateUserKVData(userId);
          break;
          
        case 'all':
          await migrateAllKVData();
          break;

        case 'cleanup':
          console.log('⚠️  WARNING: This will delete all custom_columns and categories data from KV store!');
          console.log('Make sure you have successfully migrated the data to Prisma first.');
          console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          await cleanupKVStore();
          break;
          
        default:
          console.log('Usage:');
          console.log('  npm run migrate:kv user <userId>  - Migrate KV data for specific user');
          console.log('  npm run migrate:kv all            - Migrate all users KV data');
          console.log('  npm run migrate:kv cleanup        - Clean up KV store after migration');
          process.exit(1);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

export default {
  migrateUserCustomColumns,
  migrateUserCategories,
  migrateUserKVData,
  migrateAllKVData,
  cleanupKVStore,
};
