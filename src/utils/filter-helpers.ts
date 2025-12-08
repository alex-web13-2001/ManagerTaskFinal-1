/**
 * Helper utilities for calculating available filter options
 * Implements cascading (dependent) filters
 */

import type { Task } from '../types';
import type { Filters } from '../components/filters-panel';

export interface FilterOptionCounts {
  projects: Map<string, number>;
  categories: Map<string, number>;
  statuses: Map<string, number>;
  priorities: Map<string, number>;
  assignees: Map<string, number>;
  tags: Map<string, number>;
}

/**
 * Calculate available filter options and their counts based on current filters
 * Each filter type shows counts based on tasks that match ALL other active filters
 * 
 * @param tasks - All tasks to analyze
 * @param filters - Current filter state
 * @returns Counts for each filter option showing how many tasks match
 */
export function calculateAvailableFilterOptions(
  tasks: Task[],
  filters: Filters
): FilterOptionCounts {
  const counts: FilterOptionCounts = {
    projects: new Map(),
    categories: new Map(),
    statuses: new Map(),
    priorities: new Map(),
    assignees: new Map(),
    tags: new Map(),
  };

  // For each filter type, calculate counts by applying all OTHER filters
  const filterTypes = ['projects', 'categories', 'statuses', 'priorities', 'assignees', 'tags'] as const;

  filterTypes.forEach((excludeFilter) => {
    // Get tasks that match all filters EXCEPT the one we're calculating
    const filteredTasks = tasks.filter((task) => {
      // Apply all filters except the one we're calculating
      if (excludeFilter !== 'projects' && filters.projects.length > 0) {
        const projectMatch = filters.projects.includes(task.projectId || 'personal');
        if (!projectMatch) return false;
      }

      if (excludeFilter !== 'categories' && filters.categories.length > 0) {
        const taskCategory = task.categoryId || 'none';
        if (!filters.categories.includes(taskCategory)) return false;
      }

      if (excludeFilter !== 'statuses' && filters.statuses.length > 0) {
        if (!filters.statuses.includes(task.status)) return false;
      }

      if (excludeFilter !== 'priorities' && filters.priorities.length > 0) {
        if (!filters.priorities.includes(task.priority)) return false;
      }

      if (excludeFilter !== 'assignees' && filters.assignees.length > 0) {
        const taskAssignee = task.assigneeId || 'unassigned';
        if (!filters.assignees.includes(taskAssignee)) return false;
      }

      if (excludeFilter !== 'tags' && filters.tags.length > 0) {
        if (!task.tags || !filters.tags.some((tag) => task.tags!.includes(tag))) {
          return false;
        }
      }

      // Deadline filter (always apply)
      if (filters.deadline !== 'all') {
        if (!task.deadline) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const taskDeadline = new Date(task.deadline);
        taskDeadline.setHours(0, 0, 0, 0);

        if (filters.deadline === 'overdue') {
          if (taskDeadline >= today) return false;
        } else if (filters.deadline === 'today') {
          if (taskDeadline.getTime() !== today.getTime()) return false;
        } else if (filters.deadline === '3days') {
          const threeDaysFromNow = new Date(today);
          threeDaysFromNow.setDate(today.getDate() + 3);
          if (taskDeadline < today || taskDeadline > threeDaysFromNow) return false;
        } else if (filters.deadline === 'week') {
          const endOfWeek = new Date(today);
          const dayOfWeek = today.getDay();
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          endOfWeek.setDate(today.getDate() + daysUntilSunday);
          if (taskDeadline < today || taskDeadline > endOfWeek) return false;
        }
      }

      return true;
    });

    // Count occurrences for this filter type
    filteredTasks.forEach((task) => {
      if (excludeFilter === 'projects') {
        const projectId = task.projectId || 'personal';
        counts.projects.set(projectId, (counts.projects.get(projectId) || 0) + 1);
      }
      
      if (excludeFilter === 'categories') {
        const categoryId = task.categoryId || 'none';
        counts.categories.set(categoryId, (counts.categories.get(categoryId) || 0) + 1);
      }
      
      if (excludeFilter === 'statuses') {
        counts.statuses.set(task.status, (counts.statuses.get(task.status) || 0) + 1);
      }
      
      if (excludeFilter === 'priorities') {
        counts.priorities.set(task.priority, (counts.priorities.get(task.priority) || 0) + 1);
      }
      
      if (excludeFilter === 'assignees') {
        const assigneeId = task.assigneeId || 'unassigned';
        counts.assignees.set(assigneeId, (counts.assignees.get(assigneeId) || 0) + 1);
      }
      
      if (excludeFilter === 'tags') {
        if (task.tags && task.tags.length > 0) {
          task.tags.forEach((tag) => {
            counts.tags.set(tag, (counts.tags.get(tag) || 0) + 1);
          });
        }
      }
    });
  });

  return counts;
}

/**
 * Get all unique tags from tasks
 * @param tasks - All tasks to extract tags from
 * @returns Array of unique tag strings
 */
export function getAllUniqueTags(tasks: Task[]): string[] {
  const tagsSet = new Set<string>();
  
  tasks.forEach((task) => {
    if (task.tags && task.tags.length > 0) {
      task.tags.forEach((tag) => tagsSet.add(tag));
    }
  });
  
  return Array.from(tagsSet).sort();
}
