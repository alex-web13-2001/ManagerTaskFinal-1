/**
 * AppContext - Backward compatibility facade
 * 
 * This file re-exports the facade implementation to maintain backward compatibility.
 * All existing code that imports from './app-context' will continue to work.
 */

export { useApp, AppProvider } from './app-context-facade';

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
