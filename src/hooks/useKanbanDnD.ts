import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner@2.0.3';
import { generateOrderKey, compareOrderKeys } from '../utils/orderKey';
import type { Task } from '../contexts/app-context';

interface UseKanbanDnDOptions {
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>, options?: { silent?: boolean }) => Promise<Task>;
}

interface TaskOrderState {
  [status: string]: string[];
}

export function useKanbanDnD({ tasks, onUpdateTask }: UseKanbanDnDOptions) {
  // Используем ref для хранения актуального списка задач
  // Это решает проблему с замыканием в handleMoveCard
  const tasksRef = useRef<Task[]>(tasks);
  
  // Обновляем ref при каждом изменении tasks
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  
  // Локальное состояние для оптимистичного обновления порядка
  const [taskOrder, setTaskOrder] = useState<TaskOrderState>({});
  
  // Сохраняем исходное состояние для отката при ошибке
  const [savedState, setSavedState] = useState<{
    taskOrder: TaskOrderState;
    taskId: string;
    originalTask?: Task;
  } | null>(null);

  // Очищаем taskOrder от устаревших ID задач
  useEffect(() => {
    const currentTaskIds = new Set(tasksRef.current.map(t => t.id));
    
    const cleanupTimer = setTimeout(() => {
      setTaskOrder(prev => {
        let needsCleanup = false;
        const cleanedOrder: TaskOrderState = {};
        
        Object.entries(prev).forEach(([status, ids]) => {
          const cleanedIds = ids.filter(id => currentTaskIds.has(id));
          if (cleanedIds.length !== ids.length) {
            needsCleanup = true;
          }
          if (cleanedIds.length > 0) {
            cleanedOrder[status] = cleanedIds;
          }
        });
        
        if (needsCleanup) {
          console.log('[useKanbanDnD] Cleaned up stale task IDs from order');
          return cleanedOrder;
        }
        
        return prev;
      });
    }, 100);

    return () => clearTimeout(cleanupTimer);
  }, [tasks]);

  // Обработчик перемещения карточки
  const handleMoveCard = useCallback(async (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after',
    columnTasks: Task[]
  ) => {
    // Используем tasksRef.current для получения актуального списка задач
    const draggedTask = tasksRef.current.find(t => t.id === draggedId);
    const targetTask = tasksRef.current.find(t => t.id === targetId);
    
    if (!draggedTask || !targetTask) {
      console.log('[useKanbanDnD] Task not found:', { draggedId, targetId });
      return;
    }

    const sourceStatus = draggedTask.status;
    const targetStatus = targetTask.status;
    
    console.log('[useKanbanDnD] Moving card:', { draggedId, sourceStatus, targetStatus, position });
    
    // Получаем все задачи целевого столбца, отсортированные по orderKey
    const targetColumnTasksSorted = columnTasks
      .filter(t => t.status === targetStatus)
      .sort((a, b) => compareOrderKeys(a.orderKey || 'n', b.orderKey || 'n'));
    
    // Находим индекс целевой задачи
    const targetIndex = targetColumnTasksSorted.findIndex(t => t.id === targetId);
    
    // Вычисляем новый orderKey на основе соседей
    let newOrderKey: string;
    let beforeTask: Task | undefined;
    let afterTask: Task | undefined;
    
    if (position === 'before') {
      // Вставляем перед целевой задачей
      afterTask = targetTask;
      beforeTask = targetIndex > 0 ? targetColumnTasksSorted[targetIndex - 1] : undefined;
    } else {
      // Вставляем после целевой задачи
      beforeTask = targetTask;
      afterTask = targetIndex < targetColumnTasksSorted.length - 1 ? targetColumnTasksSorted[targetIndex + 1] : undefined;
    }
    
    // Генерируем новый orderKey между соседями
    newOrderKey = generateOrderKey(beforeTask?.orderKey, afterTask?.orderKey);
    
    console.log('[useKanbanDnD] Generated orderKey:', {
      newOrderKey,
      beforeKey: beforeTask?.orderKey,
      afterKey: afterTask?.orderKey,
      position
    });
    
    // Сохраняем текущее состояние для возможного отката
    setSavedState({
      taskOrder: { ...taskOrder },
      taskId: draggedId,
      originalTask: draggedTask
    });
    
    // Оптимистичное обновление: сразу обновляем локальное состояние для мгновенной визуальной обратной связи
    setTaskOrder(prev => {
      const updated = { ...prev };
      
      // Get tasks for target column
      const targetColumnTaskIds = targetColumnTasksSorted.map(t => t.id);
      
      // Remove ALL instances of dragged task from order (deduplication)
      let newOrder = targetColumnTaskIds.filter(id => id !== draggedId);
      
      // Find target index
      const targetIdx = newOrder.indexOf(targetId);
      
      // Insert at the correct position
      if (targetIdx !== -1) {
        const insertIndex = position === 'before' ? targetIdx : targetIdx + 1;
        newOrder.splice(insertIndex, 0, draggedId);
      } else {
        // If target not found, add to end
        newOrder.push(draggedId);
      }
      
      // Deduplicate the final order array
      const uniqueOrder = Array.from(new Set(newOrder));
      updated[targetStatus] = uniqueOrder;
      
      // If moving between different statuses, clean up source column
      if (sourceStatus !== targetStatus && prev[sourceStatus]) {
        const cleanedSource = Array.from(new Set(prev[sourceStatus].filter(id => id !== draggedId)));
        updated[sourceStatus] = cleanedSource;
      }
      
      console.log('[useKanbanDnD] Updated taskOrder (optimistic, deduplicated):', updated);
      return updated;
    });
    
    // Обновляем задачу на сервере с новым orderKey и статусом
    const updates: Partial<Task> = {
      orderKey: newOrderKey,
    };
    
    // Если меняется статус, добавляем его в обновления
    if (sourceStatus !== targetStatus) {
      updates.status = targetStatus;
    }
    
    // Отправляем обновление на сервер
    try {
      await onUpdateTask(draggedId, updates, { silent: true });
      // Успешно сохранено - очищаем сохраненное состояние
      setSavedState(null);
    } catch (error) {
      console.error('[useKanbanDnD] Failed to update task:', error);
      
      // Откатываем изменения
      if (savedState) {
        setTaskOrder(savedState.taskOrder);
        toast.error('Не удалось переместить задачу. Изменения отменены.');
      }
      
      // Очищаем сохраненное состояние
      setSavedState(null);
    }
  }, [taskOrder, onUpdateTask, savedState]); // Убрали tasks из зависимостей, используем tasksRef

  // Обработчик изменения статуса (перетаскивание в пустую колонку)
  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    // Используем tasksRef.current для получения актуального списка задач
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;
    
    // Сохраняем текущее состояние
    setSavedState({
      taskOrder: { ...taskOrder },
      taskId,
      originalTask: task
    });
    
    try {
      await onUpdateTask(taskId, { status: newStatus }, { silent: true });
      // Успешно - очищаем сохраненное состояние
      setSavedState(null);
    } catch (error) {
      console.error('[useKanbanDnD] Failed to change task status:', error);
      
      // При ошибке показываем уведомление (откат произойдет автоматически в updateTask)
      if (savedState) {
        setTaskOrder(savedState.taskOrder);
        toast.error('Не удалось изменить статус задачи');
      }
      
      setSavedState(null);
    }
  }, [taskOrder, onUpdateTask, savedState]); // Убрали tasks из зависимостей, используем tasksRef

  return {
    taskOrder,
    handleMoveCard,
    handleStatusChange,
  };
}
