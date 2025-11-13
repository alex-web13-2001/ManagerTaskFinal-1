/**
 * Recurring Task Processor
 * Checks for completed recurring tasks and resets them based on their recurrence pattern
 */

import prisma from './db';
import { emitTaskUpdated } from './websocket.js';

/**
 * Calculate next due date based on recurrence pattern
 */
function calculateNextDueDate(lastCompleted: Date, pattern: string, originalDueDate: Date | null): Date {
  const now = new Date();
  const baseDate = lastCompleted > now ? lastCompleted : now;
  
  switch (pattern) {
    case 'daily':
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
    
    case 'weekly':
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    case 'monthly':
      const nextMonth = new Date(baseDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    
    case 'yearly':
      const nextYear = new Date(baseDate);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return nextYear;
    
    default:
      // Default to weekly if pattern is unknown
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Process recurring tasks
 * Find completed recurring tasks that need to be reset
 */
export async function processRecurringTasks() {
  try {
    console.log('🔄 Processing recurring tasks...');
    
    // Find all completed recurring tasks
    const completedRecurringTasks = await prisma.task.findMany({
      where: {
        isRecurring: true,
        status: 'done',
        recurrencePattern: {
          not: null,
        },
      },
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
    });

    console.log(`📊 Found ${completedRecurringTasks.length} completed recurring tasks`);

    let resetCount = 0;

    for (const task of completedRecurringTasks) {
      // Check if task should be reset
      const lastCompleted = task.lastCompleted || task.updatedAt;
      const now = new Date();
      
      // Calculate when the next occurrence should be
      const nextDueDate = calculateNextDueDate(lastCompleted, task.recurrencePattern!, task.dueDate);
      
      // Only reset if the next occurrence date has passed
      if (now >= nextDueDate) {
        console.log(`🔁 Resetting recurring task: ${task.title} (${task.id})`);
        
        // Reset the task to 'in_progress' status and update due date
        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'in_progress',
            dueDate: nextDueDate,
            updatedAt: new Date(),
          },
          include: {
            project: true,
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            attachments: true,
          },
        });

        // Emit WebSocket event for real-time update
        const transformedTask = {
          ...updatedTask,
          deadline: updatedTask.dueDate ? updatedTask.dueDate.toISOString() : undefined,
          categoryId: updatedTask.category,
          userId: updatedTask.creatorId,
          dueDate: updatedTask.dueDate ? updatedTask.dueDate.toISOString() : undefined,
          category: updatedTask.category,
        };
        
        emitTaskUpdated(transformedTask, updatedTask.projectId || undefined);
        
        resetCount++;
      }
    }

    console.log(`✅ Recurring task processing complete. Reset ${resetCount} tasks.`);
    
    return { processed: completedRecurringTasks.length, reset: resetCount };
  } catch (error) {
    console.error('❌ Error processing recurring tasks:', error);
    throw error;
  }
}

/**
 * Start recurring task processor with interval
 * Runs every hour by default
 */
export function startRecurringTaskProcessor(intervalMinutes: number = 60) {
  console.log(`🚀 Starting recurring task processor (interval: ${intervalMinutes} minutes)`);
  
  // Run immediately on start
  processRecurringTasks().catch(console.error);
  
  // Run periodically
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervalId = setInterval(() => {
    processRecurringTasks().catch(console.error);
  }, intervalMs);
  
  return intervalId;
}
