/**
 * AppContext - Type re-exports for backward compatibility
 * 
 * This file only re-exports types from the types module.
 * All components should now use domain-specific hooks:
 * - useAuth() for user, categories, customColumns
 * - useTasks() for tasks operations
 * - useProjects() for projects operations
 * - useUI() for UI state (isDragging, etc.)
 * - useWebSocket() for WebSocket operations
 */

// Re-export types for backward compatibility
export type {
  Task,
  TaskAttachment,
  Comment,
  Project,
  ProjectLink,
  ProjectAttachment,
  User,
  UserRole,
  TeamMember,
  CustomColumn,
  Category,
} from '../types';
