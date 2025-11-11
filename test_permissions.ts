/**
 * Manual test script for permission functions
 * Tests the corrected access control logic
 */

import prisma from './src/server/db';
import { 
  getUserRoleInProject, 
  canEditTask, 
  canDeleteTask 
} from './src/lib/permissions';

async function testPermissions() {
  console.log('🧪 Testing Access Control Permissions\n');
  
  try {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        name: 'Test User',
      },
    });
    console.log('✅ Created test user:', testUser.id);

    // Create test project
    const testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        ownerId: testUser.id,
      },
    });
    console.log('✅ Created test project:', testProject.id);

    // Create another user to be a member
    const memberUser = await prisma.user.create({
      data: {
        email: `member-${Date.now()}@example.com`,
        password: 'test123456',
        name: 'Member User',
      },
    });
    console.log('✅ Created member user:', memberUser.id);

    // Add member to project with 'member' role
    await prisma.projectMember.create({
      data: {
        userId: memberUser.id,
        projectId: testProject.id,
        role: 'member',
      },
    });
    console.log('✅ Added member to project with role: member');

    // Create a test task
    const testTask = await prisma.task.create({
      data: {
        title: 'Test Task',
        creatorId: testUser.id,
        projectId: testProject.id,
        assigneeId: memberUser.id,
      },
    });
    console.log('✅ Created test task:', testTask.id);

    // Test 1: Owner can delete
    console.log('\n📝 Test 1: Owner can delete task');
    const ownerCanDelete = await canDeleteTask(testUser.id, testTask.id);
    console.log(`   Result: ${ownerCanDelete ? '✅ PASS' : '❌ FAIL'} (Expected: true, Got: ${ownerCanDelete})`);

    // Test 2: Member CANNOT delete (this is the fix!)
    console.log('\n📝 Test 2: Member CANNOT delete task (even if assigned)');
    const memberCanDelete = await canDeleteTask(memberUser.id, testTask.id);
    console.log(`   Result: ${memberCanDelete ? '❌ FAIL' : '✅ PASS'} (Expected: false, Got: ${memberCanDelete})`);

    // Test 3: Member CAN edit their assigned task
    console.log('\n📝 Test 3: Member CAN edit assigned task');
    const memberCanEdit = await canEditTask(memberUser.id, testTask.id);
    console.log(`   Result: ${memberCanEdit ? '✅ PASS' : '❌ FAIL'} (Expected: true, Got: ${memberCanEdit})`);

    // Test 4: Check role retrieval
    console.log('\n📝 Test 4: getUserRoleInProject returns correct role');
    const ownerRole = await getUserRoleInProject(testUser.id, testProject.id);
    const memberRole = await getUserRoleInProject(memberUser.id, testProject.id);
    console.log(`   Owner role: ${ownerRole === 'owner' ? '✅ PASS' : '❌ FAIL'} (Expected: owner, Got: ${ownerRole})`);
    console.log(`   Member role: ${memberRole === 'member' ? '✅ PASS' : '❌ FAIL'} (Expected: member, Got: ${memberRole})`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.task.delete({ where: { id: testTask.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: testProject.id } });
    await prisma.project.delete({ where: { id: testProject.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.user.delete({ where: { id: memberUser.id } });
    console.log('✅ Cleanup complete');

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPermissions();
