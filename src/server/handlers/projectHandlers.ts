import { Request, Response } from 'express';
import prisma from '../db';

/**
 * POST /api/projects
 * Создать новый проект (любой авторизованный пользователь может создать)
 * 
 * Критическая функция: автоматически добавляет создателя проекта как владельца (OWNER)
 * в таблицу ProjectMember с использованием транзакции Prisma для атомарности операций.
 */
export async function createProject(req: Request, res: Response) {
  try {
    const { name, description, color, availableCategories, links } = req.body;
    const ownerId = (req as any).user!.sub;

    if (!name) {
      return res.status(400).json({ error: 'Название проекта обязательно' });
    }

    // Используем транзакцию для обеспечения атомарности:
    // Обе операции (создание проекта и добавление владельца как участника)
    // выполнятся успешно, либо не выполнится ни одна
    const project = await prisma.$transaction(async (tx) => {
      // Шаг 1: Создать проект
      const newProject = await tx.project.create({
        data: {
          name,
          description: description || null,
          color: color || '#3b82f6',
          ownerId: ownerId,
          availableCategories: Array.isArray(availableCategories) ? availableCategories : [],
          links: links !== undefined ? links : null,
        },
      });

      // Шаг 2: Немедленно добавить владельца как участника с ролью 'owner'
      // Это связывает владение с системой контроля доступа
      await tx.projectMember.create({
        data: {
          userId: ownerId,
          projectId: newProject.id,
          role: 'owner',
        },
      });

      return newProject;
    });

    // Получить проект со всеми связанными данными для возврата согласованного ответа
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

    res.status(201).json(projectWithMembers);
  } catch (error: any) {
    console.error('Не удалось создать проект или запись участника проекта:', error);
    res.status(500).json({ error: 'Не удалось создать проект' });
  }
}
