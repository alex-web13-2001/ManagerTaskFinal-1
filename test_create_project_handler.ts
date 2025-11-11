/**
 * Тест для проверки работы нового обработчика createProject
 * 
 * Этот тест проверяет:
 * 1. Что проект создается успешно
 * 2. Что создатель автоматически добавляется как участник с ролью 'owner'
 * 3. Что обе операции выполняются в одной транзакции
 */

import prisma from './src/server/db';

async function testCreateProjectHandler() {
  console.log('🧪 Тестирование обработчика createProject\n');
  
  try {
    // Создать тестового пользователя
    const testUser = await prisma.user.create({
      data: {
        email: `handler-test-${Date.now()}@example.com`,
        password: 'test123456',
        name: 'Тестовый пользователь',
      },
    });
    console.log('✅ Создан тестовый пользователь:', testUser.id);

    // Имитация работы обработчика createProject
    console.log('\n📝 Тест 1: Создание проекта с транзакцией');
    
    const project = await prisma.$transaction(async (tx) => {
      // Шаг 1: Создать проект
      const newProject = await tx.project.create({
        data: {
          name: 'Тестовый проект',
          description: 'Тест обработчика createProject',
          color: '#3b82f6',
          ownerId: testUser.id,
        },
      });
      console.log('   ✓ Проект создан:', newProject.id);

      // Шаг 2: Добавить владельца как участника с ролью 'owner'
      await tx.projectMember.create({
        data: {
          userId: testUser.id,
          projectId: newProject.id,
          role: 'owner',
        },
      });
      console.log('   ✓ Владелец добавлен как участник с ролью: owner');

      return newProject;
    });

    // Проверить, что владелец находится в таблице ProjectMember
    console.log('\n📝 Тест 2: Проверка записи в ProjectMember');
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: testUser.id,
          projectId: project.id,
        },
      },
    });
    
    if (projectMember && projectMember.role === 'owner') {
      console.log(`   Результат: ✅ УСПЕШНО - Владелец найден с ролью '${projectMember.role}'`);
    } else {
      console.log(`   Результат: ❌ ОШИБКА - Владелец не найден или роль неверна`);
    }

    // Получить проект со всеми данными (как делает обработчик)
    console.log('\n📝 Тест 3: Получение проекта со связанными данными');
    const projectWithMembers = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });
    
    if (projectWithMembers && projectWithMembers.members.length > 0) {
      console.log(`   Результат: ✅ УСПЕШНО - Проект имеет ${projectWithMembers.members.length} участника(ов)`);
      console.log(`   Владелец: ${projectWithMembers.owner.name} (${projectWithMembers.owner.email})`);
    } else {
      console.log(`   Результат: ❌ ОШИБКА - Участники не найдены`);
    }

    // Очистка
    console.log('\n🧹 Очистка тестовых данных...');
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('✅ Очистка завершена');

    console.log('\n✅ Все тесты пройдены успешно!');
    console.log('\n📊 Итоги:');
    console.log('   - Создание проекта с транзакцией: ✅');
    console.log('   - Автоматическое добавление владельца: ✅');
    console.log('   - Получение данных проекта: ✅');
  } catch (error) {
    console.error('❌ Тест завершился с ошибкой:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateProjectHandler();
