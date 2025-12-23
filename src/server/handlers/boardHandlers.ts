import { Request, Response } from 'express';
import prisma from '../db';
import { AuthRequest } from '../middleware/auth';
import { Board, BoardElement } from '@prisma/client';

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
 * Transform board element from database format to API response format
 */
function transformElementForResponse(element: BoardElement): any {
  return {
    ...element,
    createdAt: element.createdAt instanceof Date ? element.createdAt.toISOString() : element.createdAt,
    updatedAt: element.updatedAt instanceof Date ? element.updatedAt.toISOString() : element.updatedAt,
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

/**
 * POST /api/boards/:id/elements
 * Добавить элемент на доску
 */
export async function createElement(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { type, positionX, positionY, width, height, content, imageUrl, color, fontSize, zIndex, rotation, videoUrl, videoType, displayMode, videoMeta } = req.body;
    const userId = (req as AuthRequest).user!.sub;

    // Debug: логировать создание video элемента
    if (type === 'video') {
      console.log('[CREATE VIDEO ELEMENT]', {
        videoUrl,
        videoType,
        displayMode,
        videoMeta: videoMeta ? 'present' : 'null'
      });
    }

    // Проверить права доступа к доске
    const board = await prisma.board.findUnique({
      where: { id },
    });

    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    if (board.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для добавления элементов на эту доску' });
    }

    // Создать элемент
    const element = await prisma.boardElement.create({
      data: {
        type,
        positionX: positionX || 0,
        positionY: positionY || 0,
        width: width || 200,
        height: height || 150,
        zIndex: zIndex || 0,
        rotation: rotation || 0,
        content: content || null,
        imageUrl: imageUrl || null,
        color: color || null,
        fontSize: fontSize || null,
        videoUrl: videoUrl || null,
        videoType: videoType || null,
        displayMode: displayMode || null,
        videoMeta: videoMeta || null,
        boardId: id,
      },
    });

    res.status(201).json(transformElementForResponse(element));
  } catch (error: any) {
    console.error('Failed to create element:', error);
    res.status(500).json({ error: 'Не удалось создать элемент' });
  }
}

/**
 * PUT /api/boards/:id/elements/:elementId
 * Обновить элемент
 */
export async function updateElement(req: Request, res: Response) {
  try {
    const { id, elementId } = req.params;
    const { positionX, positionY, width, height, zIndex, rotation, content, imageUrl, color, fontSize, videoUrl, videoType, displayMode, videoMeta } = req.body;
    const userId = (req as AuthRequest).user!.sub;

    // Проверить права доступа
    const element = await prisma.boardElement.findUnique({
      where: { id: elementId },
      include: { board: true },
    });

    if (!element) {
      return res.status(404).json({ error: 'Элемент не найден' });
    }

    if (element.boardId !== id) {
      return res.status(400).json({ error: 'Элемент не принадлежит этой доске' });
    }

    if (element.board.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этого элемента' });
    }

    // Подготовить данные для обновления
    const updateData: any = {};
    if (positionX !== undefined) updateData.positionX = positionX;
    if (positionY !== undefined) updateData.positionY = positionY;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;
    if (zIndex !== undefined) updateData.zIndex = zIndex;
    if (rotation !== undefined) updateData.rotation = rotation;
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (color !== undefined) updateData.color = color;
    if (fontSize !== undefined) updateData.fontSize = fontSize;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (videoType !== undefined) updateData.videoType = videoType;
    if (displayMode !== undefined) updateData.displayMode = displayMode;
    if (videoMeta !== undefined) updateData.videoMeta = videoMeta;

    // Debug: логировать обновление video полей
    if (videoUrl !== undefined || displayMode !== undefined) {
      console.log('[UPDATE VIDEO ELEMENT]', elementId, {
        videoUrl,
        displayMode,
        videoMeta: videoMeta ? 'present' : 'null'
      });
    }

    // Обновить элемент
    const updatedElement = await prisma.boardElement.update({
      where: { id: elementId },
      data: updateData,
    });

    res.json(transformElementForResponse(updatedElement));
  } catch (error: any) {
    console.error('Failed to update element:', error);
    res.status(500).json({ error: 'Не удалось обновить элемент' });
  }
}

/**
 * DELETE /api/boards/:id/elements/:elementId
 * Удалить элемент
 */
export async function deleteElement(req: Request, res: Response) {
  try {
    const { id, elementId } = req.params;
    const userId = (req as AuthRequest).user!.sub;

    // Проверить права доступа
    const element = await prisma.boardElement.findUnique({
      where: { id: elementId },
      include: { board: true },
    });

    if (!element) {
      return res.status(404).json({ error: 'Элемент не найден' });
    }

    if (element.boardId !== id) {
      return res.status(400).json({ error: 'Элемент не принадлежит этой доске' });
    }

    if (element.board.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления этого элемента' });
    }

    // Удалить элемент
    await prisma.boardElement.delete({
      where: { id: elementId },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Failed to delete element:', error);
    res.status(500).json({ error: 'Не удалось удалить элемент' });
  }
}

/**
 * POST /api/boards/:id/upload-image
 * Загрузить изображение для элемента доски
 */
export async function uploadBoardImage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user!.sub;

    // Проверить права доступа к доске
    const board = await prisma.board.findUnique({
      where: { id },
    });

    if (!board) {
      return res.status(404).json({ error: 'Доска не найдена' });
    }

    if (board.ownerId !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для загрузки изображений на эту доску' });
    }

    // Проверить наличие файла
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    // Вернуть URL загруженного файла
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({ url: fileUrl });
  } catch (error: any) {
    console.error('Failed to upload image:', error);
    res.status(500).json({ error: 'Не удалось загрузить изображение' });
  }
}
