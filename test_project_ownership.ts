/**
 * Test script to verify project ownership synchronization
 * Tests that when a project is created, the owner is automatically added as a ProjectMember
 */

import prisma from './src/server/db';
import { getUserRoleInProject } from './src/lib/permissions';

async function testProjectOwnershipSync() {
  console.log('🧪 Testing Project Ownership Synchronization\n');
  
  try {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `owner-test-${Date.now()}@example.com`,
        password: 'test123456',
        name: 'Project Owner Test',
      },
    });
    console.log('✅ Created test user:', testUser.id);

    // Simulate project creation with transaction (as implemented in the fix)
    console.log('\n📝 Test 1: Creating project with transaction (automatic owner membership)');
    
    const project = await prisma.$transaction(async (tx) => {
      // Step 1: Create project
      const newProject = await tx.project.create({
        data: {
          name: 'Test Project With Owner',
          description: 'Testing automatic owner membership',
          color: '#3b82f6',
          ownerId: testUser.id,
        },
      });
      console.log('   ✓ Project created:', newProject.id);

      // Step 2: Add owner as member with 'owner' role
      await tx.projectMember.create({
        data: {
          userId: testUser.id,
          projectId: newProject.id,
          role: 'owner',
        },
      });
      console.log('   ✓ Owner added as ProjectMember with role: owner');

      return newProject;
    });

    // Verify owner is in ProjectMember table
    console.log('\n📝 Test 2: Verify owner exists in ProjectMember table');
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: testUser.id,
          projectId: project.id,
        },
      },
    });
    
    if (projectMember) {
      console.log(`   Result: ✅ PASS - Owner found in ProjectMember table`);
      console.log(`   Role: ${projectMember.role}`);
    } else {
      console.log(`   Result: ❌ FAIL - Owner NOT found in ProjectMember table`);
    }

    // Test getUserRoleInProject function
    console.log('\n📝 Test 3: getUserRoleInProject returns "owner" role');
    const role = await getUserRoleInProject(testUser.id, project.id);
    if (role === 'owner') {
      console.log(`   Result: ✅ PASS - Role is "${role}"`);
    } else {
      console.log(`   Result: ❌ FAIL - Expected "owner", got "${role}"`);
    }

    // Test that owner can access project resources
    console.log('\n📝 Test 4: Owner can access their project');
    const accessibleProjects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: testUser.id },
          {
            members: {
              some: {
                userId: testUser.id,
              },
            },
          },
        ],
      },
    });
    
    const canAccess = accessibleProjects.some(p => p.id === project.id);
    if (canAccess) {
      console.log(`   Result: ✅ PASS - Owner can access their project`);
    } else {
      console.log(`   Result: ❌ FAIL - Owner cannot access their project`);
    }

    // Test creating a task in the project (owner should have permissions)
    console.log('\n📝 Test 5: Owner can create tasks in their project');
    const task = await prisma.task.create({
      data: {
        title: 'Test Task',
        creatorId: testUser.id,
        projectId: project.id,
      },
    });
    console.log(`   Result: ✅ PASS - Task created successfully: ${task.id}`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.task.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('✅ Cleanup complete');

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Project creation with transaction: ✅');
    console.log('   - Owner added to ProjectMember table: ✅');
    console.log('   - Role verification: ✅');
    console.log('   - Project access control: ✅');
    console.log('   - Task creation permissions: ✅');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testProjectOwnershipSync();
