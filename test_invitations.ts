import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Создаем проект
  const adminId = 'df64fa6a-eb1c-45a6-8397-8ccb75280591';
  const testUserId = '6c91eb73-d8e7-4b1e-a1ea-f0d421df91a0';
  
  const project = await prisma.project.create({
    data: {
      id: `project_${Date.now()}_test`,
      name: 'Тестовый проект для приглашения',
      description: 'Проект для тестирования системы приглашений',
      owner_id: adminId,
      color: 'purple',
    },
  });
  
  console.log('✅ Проект создан:', { id: project.id, name: project.name });
  
  // Создаем приглашение
  const invitationId = `inv_${Date.now()}`;
  const invitation = {
    invitationId,
    projectId: project.id,
    projectName: project.name,
    inviterEmail: 'admin@example.com',
    inviterName: 'Admin User',
    inviteeEmail: 'test@example.com',
    role: 'collaborator', // Роль: Участник с правами
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 дней
    createdAt: new Date().toISOString(),
  };
  
  // Сохраняем приглашение в KV Store
  await prisma.kvStore.upsert({
    where: { key: `invitation:${invitationId}` },
    create: {
      key: `invitation:${invitationId}`,
      value: JSON.stringify(invitation),
    },
    update: {
      value: JSON.stringify(invitation),
    },
  });
  
  console.log('✅ Приглашение создано:', { 
    invitationId,
    inviteeEmail: invitation.inviteeEmail,
    role: invitation.role,
  });
  
  // Добавляем приглашение в список ожидающих
  const pendingKey = 'pending_invitations';
  const pending = await prisma.kvStore.findUnique({ where: { key: pendingKey } });
  let pendingInvitations = pending ? JSON.parse(pending.value as string) : [];
  pendingInvitations.push(invitation);
  
  await prisma.kvStore.upsert({
    where: { key: pendingKey },
    create: {
      key: pendingKey,
      value: JSON.stringify(pendingInvitations),
    },
    update: {
      value: JSON.stringify(pendingInvitations),
    },
  });
  
  console.log('✅ Приглашение добавлено в список ожидающих');
  
  // Добавляем тестового пользователя в проект напрямую с ролью collaborator
  await prisma.kvStore.upsert({
    where: { key: `project_members:${project.id}` },
    create: {
      key: `project_members:${project.id}`,
      value: JSON.stringify([
        { userId: adminId, role: 'owner' },
        { userId: testUserId, role: 'collaborator' }, // Участник с правами
      ]),
    },
    update: {
      value: JSON.stringify([
        { userId: adminId, role: 'owner' },
        { userId: testUserId, role: 'collaborator' },
      ]),
    },
  });
  
  console.log('✅ Тестовый пользователь добавлен в проект с ролью collaborator');
  
  // Добавляем проект в список проектов админа
  const adminProjectsKey = `projects:${adminId}`;
  const adminProjects = await prisma.kvStore.findUnique({ where: { key: adminProjectsKey } });
  let projects = adminProjects ? JSON.parse(adminProjects.value as string) : [];
  projects.push({
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    owner_id: adminId,
    created_at: project.created_at.toISOString(),
  });
  
  await prisma.kvStore.upsert({
    where: { key: adminProjectsKey },
    create: {
      key: adminProjectsKey,
      value: JSON.stringify(projects),
    },
    update: {
      value: JSON.stringify(projects),
    },
  });
  
  console.log('✅ Проект добавлен в список проектов админа');
  
  // Добавляем проект в список общих проектов тестового пользователя
  const sharedProjectsKey = `shared_projects:${testUserId}`;
  await prisma.kvStore.upsert({
    where: { key: sharedProjectsKey },
    create: {
      key: sharedProjectsKey,
      value: JSON.stringify([
        {
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
          owner_id: adminId,
          role: 'collaborator',
        },
      ]),
    },
    update: {
      value: JSON.stringify([
        {
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
          owner_id: adminId,
          role: 'collaborator',
        },
      ]),
    },
  });
  
  console.log('✅ Проект добавлен в общие проекты тестового пользователя');
  console.log('\n🎉 Тестирование системы приглашений завершено!');
  console.log(`\n📋 Итоговая информация:`);
  console.log(`  Проект ID: ${project.id}`);
  console.log(`  Приглашение ID: ${invitationId}`);
  console.log(`  Email приглашенного: test@example.com`);
  console.log(`  Роль: collaborator (Участник с правами)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Ошибка:', error);
    prisma.$disconnect();
    process.exit(1);
  });
