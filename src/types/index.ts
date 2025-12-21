/**
 * Shared domain types for the application
 * Extracted from contexts to avoid circular dependencies
 */

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Comment {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  mentionedUsers?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  deadline?: string;
  projectId?: string;
  categoryId?: string;
  assigneeId?: string;
  userId?: string; // Создатель задачи
  tags?: string[];
  attachments?: TaskAttachment[];
  comments?: Comment[];
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
  // Поля для повторяющихся задач
  isRecurring?: boolean;
  recurringStartDate?: string;
  recurringIntervalDays?: number;
  parentRecurringTaskId?: string; // ID родительской повторяющейся задачи
  // Поле для стабильного упорядочивания без переиндексации
  orderKey?: string; // Лексикографический ключ для сортировки (Base36)
  version?: number; // Монотонный счетчик для оптимистичной конкурентности
}

export interface ProjectLink {
  id: string;
  name: string;
  url: string;
}

export interface ProjectAttachment {
  id: string;
  name: string;
  size: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  category?: string; // Строка для отображения
  availableCategories?: string[]; // Массив ID категорий, доступных для задач в проекте
  status?: string;
  userId?: string; // Владелец проекта
  members?: any[];
  links?: ProjectLink[];
  attachments?: ProjectAttachment[];
  archived?: boolean; // Флаг архивирования
  archivedAt?: string; // Дата архивирования
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string;
}

export type UserRole = 'owner' | 'admin' | 'collaborator' | 'member' | 'viewer' | null;

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface CustomColumn {
  id: string;
  title: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  color: string;
  thumbnail?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardElement {
  id: string;
  type: 'note' | 'image' | 'heading' | 'text';
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  rotation: number;
  content?: string;
  imageUrl?: string;
  color?: string;
  fontSize?: number;
  boardId: string;
  createdAt: string;
  updatedAt: string;
}
