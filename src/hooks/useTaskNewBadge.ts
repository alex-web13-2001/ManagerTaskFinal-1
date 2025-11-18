import { useState, useEffect } from 'react';

const STORAGE_KEY = 'task_views_timestamp';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const TASK_READ_EVENT = 'task-read-event';

interface TaskViewsTimestamp {
  [taskId: string]: number; // timestamp in ms, or 0 for "read"
}

/**
 * Get task views from localStorage
 */
function getTaskViews(): TaskViewsTimestamp {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to read task views from localStorage:', error);
    return {};
  }
}

/**
 * Save task views to localStorage
 */
function saveTaskViews(views: TaskViewsTimestamp): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch (error) {
    console.error('Failed to save task views to localStorage:', error);
  }
}

/**
 * Mark a task as read (opened in modal)
 * This function updates localStorage and dispatches an event for reactive UI updates
 */
export function markTaskAsRead(taskId: string): void {
  const views = getTaskViews();
  views[taskId] = 0; // Special value indicating "read"
  saveTaskViews(views);
  
  // Dispatch custom event for reactive updates
  window.dispatchEvent(new CustomEvent(TASK_READ_EVENT, { detail: { taskId } }));
  
  console.log(`✅ Task ${taskId} marked as read`);
}

/**
 * Custom hook to determine if a task should show the "NEW" badge
 * 
 * @param taskId - ID of the task
 * @param createdAt - Task creation timestamp (ISO string)
 * @param creatorId - ID of user who created the task
 * @param currentUserId - ID of currently logged in user
 * @returns boolean indicating if the badge should be shown
 */
export function useTaskNewBadge(
  taskId: string,
  createdAt: string,
  creatorId: string | undefined,
  currentUserId: string | null
): boolean {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    // Check conditions for showing the badge
    const checkBadgeVisibility = () => {
      // Condition 1: Current user must be logged in
      if (!currentUserId) {
        setIsNew(false);
        return;
      }

      // Condition 2: Task must NOT be created by current user
      if (creatorId === currentUserId) {
        setIsNew(false);
        return;
      }

      // Condition 3: Task must be less than 7 days old
      const taskCreatedTime = new Date(createdAt).getTime();
      const now = Date.now();
      const taskAge = now - taskCreatedTime;
      
      if (taskAge > SEVEN_DAYS_MS) {
        setIsNew(false);
        return;
      }

      // Condition 4: Check read status and timer
      const views = getTaskViews();
      const viewTimestamp = views[taskId];

      // If task has been read (value is 0), don't show badge
      if (viewTimestamp === 0) {
        setIsNew(false);
        return;
      }

      // If this is the first time seeing this task, record the timestamp
      if (viewTimestamp === undefined) {
        const views = getTaskViews();
        views[taskId] = now;
        saveTaskViews(views);
        setIsNew(true);
        return;
      }

      // If task has been in view for more than 3 hours, don't show badge
      const timeSinceFirstView = now - viewTimestamp;
      if (timeSinceFirstView > THREE_HOURS_MS) {
        setIsNew(false);
        return;
      }

      // All conditions met - show the badge
      setIsNew(true);
    };

    checkBadgeVisibility();

    // Listen for task-read events to update badge reactively
    const handleTaskRead = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId: string }>;
      if (customEvent.detail.taskId === taskId) {
        setIsNew(false);
      }
    };

    window.addEventListener(TASK_READ_EVENT, handleTaskRead);

    // Set up interval to check timer expiration (check every minute)
    const intervalId = setInterval(checkBadgeVisibility, 60000);

    return () => {
      window.removeEventListener(TASK_READ_EVENT, handleTaskRead);
      clearInterval(intervalId);
    };
  }, [taskId, createdAt, creatorId, currentUserId]);

  return isNew;
}
