import { Request, Response } from 'express';
import prisma from '../db';

/**
 * Transform project from database format to API response format
 * Maps field names for frontend compatibility (e.g., ownerId -> userId)
 */
function transformProjectForResponse(project: any): any {
  return {
    ...project,
    // Map ownerId to userId for frontend compatibility
    userId: project.ownerId,
    // Format date fields as ISO strings
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
    updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
    archivedAt: project.archivedAt ? (project.archivedAt instanceof Date ? project.archivedAt.toISOString() : project.archivedAt) : undefined,
    // Ensure categoriesDetails is always an array (even if empty)
    categoriesDetails: project.categoriesDetails || [],
    // Ensure members is always an array (even if empty)
    members: project.members || [],
    // Ensure links is always an array (even if empty)
    links: Array.isArray(project.links) ? project.links : [],
    // Ensure attachments is always an array (even if empty)
    attachments: Array.isArray(project.attachments) ? project.attachments : [],
  };
}

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

    // Transform project for API response (ownerId -> userId mapping)
    const transformedProject = transformProjectForResponse(projectWithMembers);

    res.status(201).json(transformedProject);
  } catch (error: any) {
    console.error('Не удалось создать проект или запись участника проекта:', error);
    
    // Handle Prisma error codes
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Проект с таким именем уже существует' });
    }
    
    res.status(500).json({ error: 'Не удалось создать проект' });
  }
}
