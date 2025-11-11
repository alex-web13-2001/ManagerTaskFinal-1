/**
 * Data migration utility
 * Migrates data from KV store to Prisma models
 */

import prisma from '../server/db';
import * as kv from '../server/kv_store';

interface KVProject {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  archived?: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  members?: any[];
  invitations?: any[];
}

interface KVTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  category?: string;
  tags?: string[];
  dueDate?: string;
  projectId?: string;
  userId: string; // creator
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Migrate projects from KV store to Prisma for a specific user
 */
export async function migrateUserProjects(userId: string): Promise<void> {
  console.log(`Migrating projects for user ${userId}...`);
  
  try {
    // Get projects from KV store
    const kvProjects: KVProject[] = (await kv.get(`projects:${userId}`)) || [];
    
    for (const kvProject of kvProjects) {
      // Check if project already exists in Prisma
      const existingProject = await prisma.project.findUnique({
        where: { id: kvProject.id },
      });
      
      if (existingProject) {
        console.log(`Project ${kvProject.id} already migrated, skipping...`);
        continue;
      }
      
      // Create project in Prisma
      const project = await prisma.project.create({
        data: {
          id: kvProject.id,
          name: kvProject.name,
          description: kvProject.description || null,
          color: kvProject.color || '#3b82f6',
          icon: kvProject.icon || null,
          archived: kvProject.archived || false,
          ownerId: kvProject.userId,
          createdAt: new Date(kvProject.createdAt),
          updatedAt: new Date(kvProject.updatedAt),
        },
      });
      
      console.log(`✅ Migrated project: ${project.name}`);
      
      // Migrate project members
      if (kvProject.members && Array.isArray(kvProject.members)) {
        for (const member of kvProject.members) {
          // Skip if it's the owner (owner is already set)
          if (member.role === 'owner' && member.userId === kvProject.userId) {
            continue;
          }
          
          try {
            await prisma.projectMember.create({
              data: {
                userId: member.userId || member.id,
                projectId: project.id,
                role: member.role || 'member',
              },
            });
            console.log(`  ✅ Migrated member: ${member.name || member.email}`);
          } catch (error: any) {
            if (error.code !== 'P2002') { // Ignore unique constraint errors
              console.error(`  ❌ Failed to migrate member:`, error.message);
            }
          }
        }
      }
    }
    
    // Migrate shared projects (where user is a member)
    const sharedProjects = (await kv.get(`shared_projects:${userId}`)) || [];
    
    for (const ref of sharedProjects) {
      try {
        // Ensure project exists
        const project = await prisma.project.findUnique({
          where: { id: ref.projectId },
        });
        
        if (!project) {
          console.log(`  ⚠️ Shared project ${ref.projectId} not found in database`);
          continue;
        }
        
        // Create membership if it doesn't exist
        await prisma.projectMember.upsert({
          where: {
            userId_projectId: {
              userId,
              projectId: ref.projectId,
            },
          },
          create: {
            userId,
            projectId: ref.projectId,
            role: ref.role || 'member',
          },
          update: {
            role: ref.role || 'member',
          },
        });
        
        console.log(`  ✅ Migrated shared project membership: ${ref.projectId}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to migrate shared project:`, error.message);
      }
    }
    
    console.log(`✅ Projects migration completed for user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to migrate projects for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Migrate tasks from KV store to Prisma for a specific user
 */
export async function migrateUserTasks(userId: string): Promise<void> {
  console.log(`Migrating tasks for user ${userId}...`);
  
  try {
    // Get tasks from KV store
    const kvTasks: KVTask[] = (await kv.get(`tasks:${userId}`)) || [];
    
    for (const kvTask of kvTasks) {
      // Check if task already exists
      const existingTask = await prisma.task.findUnique({
        where: { id: kvTask.id },
      });
      
      if (existingTask) {
        console.log(`Task ${kvTask.id} already migrated, skipping...`);
        continue;
      }
      
      // Create task in Prisma
      try {
        const task = await prisma.task.create({
          data: {
            id: kvTask.id,
            title: kvTask.title,
            description: kvTask.description || null,
            status: kvTask.status,
            priority: kvTask.priority || 'medium',
            category: kvTask.category || null,
            tags: kvTask.tags || [],
            dueDate: kvTask.dueDate ? new Date(kvTask.dueDate) : null,
            projectId: kvTask.projectId || null,
            creatorId: kvTask.userId,
            assigneeId: kvTask.assigneeId || null,
            createdAt: new Date(kvTask.createdAt),
            updatedAt: new Date(kvTask.updatedAt),
          },
        });
        
        console.log(`✅ Migrated task: ${task.title}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to migrate task ${kvTask.id}:`, error.message);
      }
    }
    
    console.log(`✅ Tasks migration completed for user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to migrate tasks for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Migrate all data for a user
 */
export async function migrateUserData(userId: string): Promise<void> {
  console.log(`\n========== Migrating all data for user ${userId} ==========\n`);
  
  await migrateUserProjects(userId);
  await migrateUserTasks(userId);
  
  console.log(`\n========== Migration completed for user ${userId} ==========\n`);
}

/**
 * Migrate all users' data
 */
export async function migrateAllData(): Promise<void> {
  console.log('\n========== Starting full data migration ==========\n');
  
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    
    console.log(`Found ${users.length} users to migrate`);
    
    for (const user of users) {
      console.log(`\nMigrating data for ${user.email}...`);
      try {
        await migrateUserData(user.id);
      } catch (error) {
        console.error(`Failed to migrate user ${user.email}:`, error);
        // Continue with other users
      }
    }
    
    console.log('\n========== Full migration completed ==========\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
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
            console.error('Usage: npm run migrate user <userId>');
            process.exit(1);
          }
          await migrateUserData(userId);
          break;
          
        case 'all':
          await migrateAllData();
          break;
          
        default:
          console.log('Usage:');
          console.log('  npm run migrate user <userId>  - Migrate data for specific user');
          console.log('  npm run migrate all            - Migrate all users data');
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
  migrateUserProjects,
  migrateUserTasks,
  migrateUserData,
  migrateAllData,
};
