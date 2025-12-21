import { Request, Response } from 'express';
import prisma from '../db';
import { AuthRequest } from '../middleware/auth';
import { Board } from '@prisma/client';

/**
 * Board update data type
 */
interface BoardUpdateData {
  name?: string;
  description?: string | null;
  color?: string;
}

/**
 * Transform board from database format to API response format
 */
function transformBoardForResponse(board: Board | (Board & { elements?: any[] })): any {
  return {
    ...board,
    createdAt: board.createdAt instanceof Date ? board.createdAt.toISOString() : board.createdAt,
    updatedAt: board.updatedAt instanceof Date ? board.updatedAt.toISOString() : board.updatedAt,
  };
}

/**
 * GET /api/boards
 * Получить все доски текущего пользователя
 */
export async function getBoards(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user!.sub;

    const boards = await prisma.board.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const transformedBoards = boards.map(transformBoardForResponse);
    res.json(transformedBoards);
  } catch (error: any) {
    console.error('Failed to fetch boards:', error);
    res.status(500).json({ error: 'Не удалось загрузить доски' });
  }
}

/**
 * POST /api/boards
 * Создать новую доску
 */
export async function createBoard(req: Request, res: Response) {
  try {
    const { name, description, color } = req.body;
    const userId = (req as AuthRequest).user!.sub;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название доски обязательно' });
    }

    const board = await prisma.board.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#3b82f6',
        ownerId: userId,
      },
    });

    res.status(201).json(transformBoardForResponse(board));
  } catch (error: any) {
    console.error('Failed to create board:', error);
    res.status(500).json({ error: 'Не удалось создать доску' });
  }
}

/**
 * GET /api/boards/:id
 * Получить доску с элементами
 */
export async function getBoard(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user!.sub;

    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        elements: {
          orderBy: {
            zIndex: 'asc',
          },
        },
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    // Проверка прав доступа
    if (board.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для просмотра этой доски' });
    }

    res.json(transformBoardForResponse(board));
  } catch (error: any) {
    console.error('Failed to fetch board:', error);
    res.status(500).json({ error: 'Не удалось загрузить доску' });
  }
}

/**
 * PUT /api/boards/:id
 * Обновить доску (название, описание, цвет)
 */
export async function updateBoard(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;
    const userId = (req as AuthRequest).user!.sub;

    // Проверка существования и прав доступа
    const existingBoard = await prisma.board.findUnique({
      where: { id },
    });

    if (!existingBoard) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    if (existingBoard.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этой доски' });
    }

    // Подготовка данных для обновления
    const updateData: BoardUpdateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Название доски не может быть пустым' });
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (color !== undefined) {
      updateData.color = color;
    }

    const board = await prisma.board.update({
      where: { id },
      data: updateData,
    });

    res.json(transformBoardForResponse(board));
  } catch (error: any) {
    console.error('Failed to update board:', error);
    res.status(500).json({ error: 'Не удалось обновить доску' });
  }
}

/**
 * DELETE /api/boards/:id
 * Удалить доску
 */
export async function deleteBoard(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user!.sub;

    // Проверка существования и прав доступа
    const existingBoard = await prisma.board.findUnique({
      where: { id },
    });

    if (!existingBoard) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    if (existingBoard.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления этой доски' });
    }

    // Удаление доски (элементы удалятся каскадно)
    await prisma.board.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Failed to delete board:', error);
    res.status(500).json({ error: 'Не удалось удалить доску' });
  }
}
