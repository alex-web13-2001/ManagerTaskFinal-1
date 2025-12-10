/**
 * Task History Service
 * Records changes to tasks for audit and history tracking
 */

import prisma from '../db';
import { TaskHistoryAction, Prisma } from '@prisma/client';

interface TaskData {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  projectId?: string | null;
  category?: string | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

/**
 * Record task creation event
 */
export async function recordTaskCreated(taskId: string, userId: string, taskData: TaskData) {
  try {
    await prisma.taskHistory.create({
      data: {
        taskId,
        userId,
        action: TaskHistoryAction.CREATED,
        newValue: {
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          projectId: taskData.projectId,
          categoryId: taskData.category,
          assigneeId: taskData.assigneeId,
          deadline: taskData.dueDate,
        },
      },
    });
  } catch (error) {
    console.error('Failed to record task creation:', error);
  }
}

/**
 * Record task field updates
 * Compares old and new values and creates appropriate history entries
 */
export async function recordTaskUpdates(
  taskId: string,
  userId: string,
  oldTask: TaskData,
  newTask: Partial<TaskData>
) {
  const updates: Array<{
    action: TaskHistoryAction;
    field?: string;
    oldValue?: any;
    newValue?: any;
  }> = [];

  // Title change
  if (newTask.title !== undefined && newTask.title !== oldTask.title) {
    updates.push({
      action: TaskHistoryAction.UPDATED,
      field: 'title',
      oldValue: oldTask.title,
      newValue: newTask.title,
    });
  }

  // Description change
  if (newTask.description !== undefined && newTask.description !== oldTask.description) {
    updates.push({
      action: TaskHistoryAction.UPDATED,
      field: 'description',
      oldValue: oldTask.description,
      newValue: newTask.description,
    });
  }

  // Status change
  if (newTask.status !== undefined && newTask.status !== oldTask.status) {
    updates.push({
      action: TaskHistoryAction.STATUS_CHANGED,
      field: 'status',
      oldValue: oldTask.status,
      newValue: newTask.status,
    });
  }

  // Priority change
  if (newTask.priority !== undefined && newTask.priority !== oldTask.priority) {
    updates.push({
      action: TaskHistoryAction.PRIORITY_CHANGED,
      field: 'priority',
      oldValue: oldTask.priority,
      newValue: newTask.priority,
    });
  }

  // Assignee changes
  if (newTask.assigneeId !== undefined && newTask.assigneeId !== oldTask.assigneeId) {
    if (newTask.assigneeId === null && oldTask.assigneeId !== null) {
      // Assignee removed
      updates.push({
        action: TaskHistoryAction.UNASSIGNED,
        field: 'assigneeId',
        oldValue: oldTask.assigneeId,
        newValue: null,
      });
    } else if (oldTask.assigneeId === null && newTask.assigneeId !== null) {
      // Assignee added
      updates.push({
        action: TaskHistoryAction.ASSIGNED,
        field: 'assigneeId',
        oldValue: null,
        newValue: newTask.assigneeId,
      });
    } else {
      // Assignee changed
      updates.push({
        action: TaskHistoryAction.ASSIGNED,
        field: 'assigneeId',
        oldValue: oldTask.assigneeId,
        newValue: newTask.assigneeId,
      });
    }
  }

  // Deadline changes
  if (newTask.dueDate !== undefined) {
    const oldDate = oldTask.dueDate ? new Date(oldTask.dueDate).toISOString() : null;
    const newDate = newTask.dueDate ? new Date(newTask.dueDate).toISOString() : null;

    if (oldDate !== newDate) {
      if (newDate === null && oldDate !== null) {
        // Deadline removed
        updates.push({
          action: TaskHistoryAction.DEADLINE_REMOVED,
          field: 'dueDate',
          oldValue: oldDate,
          newValue: null,
        });
      } else if (oldDate === null && newDate !== null) {
        // Deadline set
        updates.push({
          action: TaskHistoryAction.DEADLINE_SET,
          field: 'dueDate',
          oldValue: null,
          newValue: newDate,
        });
      } else {
        // Deadline changed
        updates.push({
          action: TaskHistoryAction.DEADLINE_CHANGED,
          field: 'dueDate',
          oldValue: oldDate,
          newValue: newDate,
        });
      }
    }
  }

  // Project change
  if (newTask.projectId !== undefined && newTask.projectId !== oldTask.projectId) {
    updates.push({
      action: TaskHistoryAction.PROJECT_CHANGED,
      field: 'projectId',
      oldValue: oldTask.projectId,
      newValue: newTask.projectId,
    });
  }

  // Category change
  if (newTask.category !== undefined && newTask.category !== oldTask.category) {
    updates.push({
      action: TaskHistoryAction.CATEGORY_CHANGED,
      field: 'category',
      oldValue: oldTask.category,
      newValue: newTask.category,
    });
  }

  // Record all updates
  try {
    for (const update of updates) {
      await prisma.taskHistory.create({
        data: {
          taskId,
          userId,
          action: update.action,
          field: update.field,
          oldValue: update.oldValue as Prisma.InputJsonValue,
          newValue: update.newValue as Prisma.InputJsonValue,
        },
      });
    }
  } catch (error) {
    console.error('Failed to record task updates:', error);
  }
}

/**
 * Record comment added event
 */
export async function recordCommentAdded(
  taskId: string,
  userId: string,
  commentId: string,
  commentText: string
) {
  try {
    await prisma.taskHistory.create({
      data: {
        taskId,
        userId,
        action: TaskHistoryAction.COMMENT_ADDED,
        metadata: {
          commentId,
          text: commentText.substring(0, 100), // Store first 100 chars
        },
      },
    });
  } catch (error) {
    console.error('Failed to record comment addition:', error);
  }
}

/**
 * Get task history
 */
export async function getTaskHistory(taskId: string) {
  try {
    return await prisma.taskHistory.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Failed to get task history:', error);
    return [];
  }
}
