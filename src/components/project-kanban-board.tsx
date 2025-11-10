import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Calendar, Flame, Tag, Plus, MoreHorizontal, X, Check, Trash2, AlertCircle, Paperclip, Repeat } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useDrag, useDrop } from 'react-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanBoardSkeleton } from './kanban-skeleton';
import type { Filters } from './filters-panel';
import type { Task as TaskType } from '../contexts/app-context';

const ITEM_TYPE = 'TASK_CARD';

// Draggable Task Card Component  
const DraggableTaskCard = React.forwardRef<HTMLDivElement, {
  task: TaskType;
  onClick: () => void;
  isOverdue: boolean;
  index: number;
  moveCard: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  isInitialRender: boolean;
}>(({
  task,
  onClick,
  isOverdue,
  index,
  moveCard,
  isInitialRender,
}, forwardedRef) => {
  const { teamMembers, categories } = useApp();
  const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | null>(null);
  
  const assignee = teamMembers?.find((m) => m.id === task.assigneeId);
  const category = categories.find((c) => c.id === task.categoryId);
  
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE,
    item: { taskId: task.id, currentStatus: task.status, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    hover: (item: { taskId: string; currentStatus: string; index: number }, monitor) => {
      if (item.taskId === task.id) return;
      
      const hoverBoundingRect = (monitor.getClientOffset());
      const hoverMiddleY = hoverBoundingRect ? hoverBoundingRect.y : 0;
      
      const cardElement = document.getElementById(`task-card-${task.id}`);
      if (cardElement) {
        const cardRect = cardElement.getBoundingClientRect();
        const cardMiddleY = (cardRect.top + cardRect.bottom) / 2;
        setDropPosition(hoverMiddleY < cardMiddleY ? 'before' : 'after');
      }
    },
    drop: (item: { taskId: string; currentStatus: string }) => {
      if (item.taskId !== task.id && dropPosition) {
        moveCard(item.taskId, task.id, dropPosition);
      }
      setDropPosition(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [dropPosition]);

  const combinedRef = (node: HTMLDivElement | null) => {
    drag(node);
    drop(node);
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700 border-gray-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    high: 'bg-red-100 text-red-700 border-red-300',
    urgent: 'bg-orange-100 text-orange-700 border-orange-300',
  };

  const priorityLabels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочный',
  };

  return (
    <div className="relative">
      {isOver && dropPosition === 'before' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-purple-500 rounded-full z-10">
          <div className="absolute -left-1 -top-1 w-2 h-2 bg-purple-500 rounded-full" />
          <div className="absolute -right-1 -top-1 w-2 h-2 bg-purple-500 rounded-full" />
        </div>
      )}
      
      <motion.div
        id={`task-card-${task.id}`}
        ref={combinedRef}
        layout
        layoutId={task.id}
        initial={isInitialRender ? { opacity: 1 } : { opacity: 0 }}
        animate={{ 
          opacity: isDragging ? 0.4 : 1,
        }}
        exit={{ opacity: 0 }}
        transition={{ 
          duration: 0.05,
          ease: 'easeOut',
          layout: { duration: 0.15, ease: 'easeOut' }
        }}
        className="cursor-move"
      >
      <Card
        className={`cursor-pointer hover:shadow-lg transition-shadow duration-150 ${
          task.status === 'done' ? 'opacity-60' : ''
        } ${isDragging ? 'shadow-2xl ring-2 ring-purple-400' : ''} ${
          task.isRecurring ? 'border-2 border-purple-300 bg-purple-50/30' : ''
        }`}
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {task.isRecurring && (
              <Repeat className="w-4 h-4 text-purple-600 flex-shrink-0" />
            )}
            <h4 className={`flex-1 ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </h4>
          </div>
        </CardHeader>
        <CardContent className="pb-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {category && (
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                <Tag className="w-3 h-3 mr-1" />
                {category.name}
              </Badge>
            )}
            <Badge variant="outline" className={priorityColors[task.priority]}>
              {task.priority === 'urgent' && (
                <Flame className="w-3 h-3 mr-1 fill-current" />
              )}
              {priorityLabels[task.priority]}
            </Badge>
            {task.tags && task.tags.length > 0 && (
              task.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                  {tag}
                </Badge>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {task.deadline && (
                <div
                  className={`flex items-center gap-1 text-sm ${
                    isOverdue ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span className={isOverdue ? 'font-medium' : ''}>
                    {format(new Date(task.deadline), 'dd MMM', { locale: ru })}
                  </span>
                  {isOverdue && (
                    <AlertCircle className="w-4 h-4 text-red-600 fill-red-100" />
                  )}
                </div>
              )}
              
              {task.attachments && task.attachments.length > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Paperclip className="w-4 h-4" />
                  <span>{task.attachments.length}</span>
                </div>
              )}
            </div>
            
            {assignee && (
              <div className="flex items-center gap-1.5">
                <Avatar className="w-6 h-6">
                  {assignee.avatarUrl && (
                    <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                  )}
                  <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                    {getInitials(assignee.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-500 truncate max-w-[80px]" title={assignee.name}>
                  {assignee.name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
    
    {isOver && dropPosition === 'after' && (
      <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-purple-500 rounded-full z-10">
        <div className="absolute -left-1 -top-1 w-2 h-2 bg-purple-500 rounded-full" />
        <div className="absolute -right-1 -top-1 w-2 h-2 bg-purple-500 rounded-full" />
      </div>
    )}
  </div>
  );
});

DraggableTaskCard.displayName = 'DraggableTaskCard';

// Droppable Column Component
const DroppableColumn = ({
  columnId,
  title,
  color,
  tasks,
  onDrop,
  onTaskClick,
  isOverdue,
  moveCardWithinColumn,
  isFirstRender,
}: {
  columnId: string;
  title: string;
  color: string;
  tasks: TaskType[];
  onDrop: (taskId: string, newStatus: string) => void;
  onTaskClick: (taskId: string) => void;
  isOverdue: (deadline?: string) => boolean;
  moveCardWithinColumn: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  isFirstRender: boolean;
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    drop: (item: { taskId: string; currentStatus: string }, monitor) => {
      const didDrop = monitor.didDrop();
      if (!didDrop && item.currentStatus !== columnId) {
        onDrop(item.taskId, columnId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }));

  return (
    <div ref={drop} className="flex flex-col w-80 flex-shrink-0">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="text-gray-900">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {tasks.length}
        </Badge>
      </div>

      <motion.div
        className={`flex-1 space-y-3 overflow-y-auto p-3 rounded-lg transition-all duration-300 ${
          isOver ? 'bg-purple-50 ring-2 ring-purple-300 ring-opacity-50 scale-[1.02]' : 'bg-transparent'
        }`}
        animate={{
          backgroundColor: isOver ? 'rgba(243, 232, 255, 0.5)' : 'rgba(0, 0, 0, 0)',
        }}
        transition={{ duration: 0.15 }}
      >
        <AnimatePresence mode="sync">
          {tasks.map((task, index) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              index={index}
              onClick={() => onTaskClick(task.id)}
              isOverdue={isOverdue(task.deadline)}
              moveCard={moveCardWithinColumn}
              isInitialRender={isFirstRender}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

type ProjectKanbanBoardProps = {
  projectId: string;
  searchQuery: string;
  filters: Filters;
  onTaskClick: (taskId: string) => void;
};

export function ProjectKanbanBoard({
  projectId,
  searchQuery,
  filters,
  onTaskClick,
}: ProjectKanbanBoardProps) {
  const { tasks, updateTask, getUserRoleInProject, canViewAllProjectTasks, currentUser, isInitialLoad } = useApp();
  const [isAddingColumn, setIsAddingColumn] = React.useState(false);
  const [newColumnName, setNewColumnName] = React.useState('');
  const [editingColumnId, setEditingColumnId] = React.useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = React.useState('');
  const [columnToDelete, setColumnToDelete] = React.useState<string | null>(null);
  // Task order state to preserve drag-drop order
  const [taskOrder, setTaskOrder] = React.useState<Record<string, string[]>>({});
  // Track if this is the first render to avoid fade-in animation on initial load
  const [isFirstRender, setIsFirstRender] = React.useState(true);
  
  React.useEffect(() => {
    if (!isInitialLoad && isFirstRender) {
      setIsFirstRender(false);
    }
  }, [isInitialLoad, isFirstRender]);

  // Define kanban columns
  const columnDefinitions = [
    { id: 'todo', title: 'К выполнению', color: 'bg-gray-500' },
    { id: 'in_progress', title: 'В работе', color: 'bg-blue-500' },
    { id: 'review', title: 'На проверке', color: 'bg-yellow-500' },
    { id: 'done', title: 'Готово', color: 'bg-green-500' },
  ];

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(deadline) < today;
  };

  // Filter tasks for this project
  const projectTasks = React.useMemo(() => {
    console.log('🔍 ProjectKanbanBoard filtering:', {
      projectId,
      totalTasks: tasks.length,
      tasksWithProjectId: tasks.filter(t => t.projectId).length,
      matchingTasks: tasks.filter(t => t.projectId === projectId).length,
      taskIds: tasks.map(t => ({ id: t.id, title: t.title, projectId: t.projectId }))
    });
    
    return tasks.filter((task) => {
      if (task.projectId !== projectId) return false;

      // Role-based access control: Members should only see tasks assigned to them
      if (!canViewAllProjectTasks(projectId)) {
        // Member role - only show tasks assigned to current user
        const currentUserId = currentUser?.id;
        if (!currentUserId || task.assigneeId !== currentUserId) {
          return false;
        }
      }

      // Поиск
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Фильтры
      if (filters.categories.length > 0) {
        const taskCategory = task.categoryId || 'none';
        if (!filters.categories.includes(taskCategory)) {
          return false;
        }
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false;
      }
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
      }
      if (filters.assignees.length > 0 && task.assigneeId && !filters.assignees.includes(task.assigneeId)) {
        return false;
      }
      if (filters.tags.length > 0 && task.tags) {
        const hasTag = filters.tags.some((tag) => task.tags.includes(tag));
        if (!hasTag) return false;
      }
      
      // Deadline filter
      if (filters.deadline && filters.deadline !== 'all' && task.deadline) {
        const deadline = new Date(task.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (filters.deadline) {
          case 'overdue':
            if (deadline >= today) return false;
            break;
          case 'today':
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            if (deadline < today || deadline > todayEnd) return false;
            break;
          case '3days': {
            const threeDays = new Date(today);
            threeDays.setDate(threeDays.getDate() + 3);
            if (deadline < today || deadline > threeDays) return false;
            break;
          }
          case 'week': {
            const week = new Date(today);
            week.setDate(week.getDate() + 7);
            if (deadline < today || deadline > week) return false;
            break;
          }
        }
      }
      
      if (filters.deadlineFrom && task.deadline) {
        const from = new Date(filters.deadlineFrom);
        if (new Date(task.deadline) < from) return false;
      }
      if (filters.deadlineTo && task.deadline) {
        const to = new Date(filters.deadlineTo);
        if (new Date(task.deadline) > to) return false;
      }

      return true;
    });
  }, [tasks, projectId, searchQuery, filters, canViewAllProjectTasks, currentUser]);

  // Clean up taskOrder - remove IDs that don't exist in current project tasks
  React.useEffect(() => {
    const currentTaskIds = new Set(projectTasks.map(t => t.id));
    
    setTaskOrder(prev => {
      let needsCleanup = false;
      const cleanedOrder: Record<string, string[]> = {};
      
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
        console.log('[ProjectKanban] Cleaning up taskOrder, removed stale IDs');
        return cleanedOrder;
      }
      
      return prev;
    });
  }, [projectTasks]);

  // Group tasks by status into columns
  const columns = React.useMemo(() => {
    return columnDefinitions.map((colDef) => {
      // Все задачи (и обычные и повторяющиеся) показываем по их статусу
      const columnTasks = projectTasks.filter((task) => task.status === colDef.id);
      
      // Apply custom order if exists
      if (taskOrder[colDef.id]) {
        const orderedTasks: TaskType[] = [];
        const orderMap = new Map(columnTasks.map(t => [t.id, t]));
        const seenIds = new Set<string>();
        
        // First add tasks in the specified order (with deduplication)
        taskOrder[colDef.id].forEach(taskId => {
          if (seenIds.has(taskId)) return; // Skip duplicates
          const task = orderMap.get(taskId);
          if (task) {
            orderedTasks.push(task);
            orderMap.delete(taskId);
            seenIds.add(taskId);
          }
        });
        
        // Then add any remaining tasks (with deduplication)
        orderMap.forEach(task => {
          if (!seenIds.has(task.id)) {
            orderedTasks.push(task);
            seenIds.add(task.id);
          }
        });
        
        return { ...colDef, tasks: orderedTasks };
      }
      
      // Deduplicate tasks even without custom order
      const seenIds = new Set<string>();
      const uniqueTasks = columnTasks.filter(task => {
        if (seenIds.has(task.id)) return false;
        seenIds.add(task.id);
        return true;
      });
      
      return { ...colDef, tasks: uniqueTasks };
    });
  }, [projectTasks, taskOrder]);

  // Handle task status change
  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      // Используем silent режим для перемещения карточек, чтобы не показывать toast каждый раз
      await updateTask(taskId, { status: newStatus }, { silent: true });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Handle moving card within or between columns
  const handleMoveCard = async (draggedId: string, targetId: string, position: 'before' | 'after') => {
    const draggedTask = tasks.find(t => t.id === draggedId);
    const targetTask = tasks.find(t => t.id === targetId);
    
    if (!draggedTask || !targetTask) {
      console.log('[ProjectKanban] Task not found:', { draggedId, targetId });
      return;
    }

    const sourceStatus = draggedTask.status;
    const targetStatus = targetTask.status;
    
    console.log('[ProjectKanban] Moving card:', { draggedId, sourceStatus, targetStatus, position });
    
    // Update order state IMMEDIATELY for instant visual feedback
    setTaskOrder(prev => {
      const updated = { ...prev };
      
      // Get tasks for target column
      const targetColumnTasks = projectTasks
        .filter(t => t.id === draggedId || t.status === targetStatus)
        .map(t => t.id);
      
      const currentOrder = prev[targetStatus] || targetColumnTasks;
      
      // Remove ALL instances of dragged task from order (deduplication)
      let newOrder = currentOrder.filter(id => id !== draggedId);
      
      // Find target index
      const targetIndex = newOrder.indexOf(targetId);
      
      // Insert at the correct position
      if (targetIndex !== -1) {
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
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
      
      console.log('[ProjectKanban] Updated taskOrder (deduplicated):', updated);
      return updated;
    });
    
    // If moving between columns, update status asynchronously (but don't await to avoid blocking UI)
    if (sourceStatus !== targetStatus) {
      handleTaskStatusChange(draggedId, targetStatus).catch(error => {
        console.error('[ProjectKanban] Failed to update task status:', error);
        // Optionally revert the taskOrder change here if status update fails
      });
    }
  };

  // Проверяем, является ли пользователь участником (member) с ограниченным доступом
  const userRole = getUserRoleInProject(projectId);
  const hasLimitedAccess = userRole === 'member';
  const hasNoTasks = projectTasks.length === 0;

  // Show skeleton during initial load
  if (isInitialLoad) {
    return <KanbanBoardSkeleton columnCount={4} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Подсказка для участников с ограниченным доступом */}
      {hasLimitedAccess && hasNoTasks && (
        <div className="mx-4 md:mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-medium mb-1">
                Вы видите только назначенные на вас задачи
              </p>
              <p className="text-xs text-blue-700">
                Как <strong>Участник</strong> проекта, вы видите только те задачи, где вы назначены исполнителем. 
                Чтобы увидеть все задачи проекта, попросите владельца проекта изменить вашу роль на <strong>"Участник с правами"</strong> или <strong>"Наблюдатель"</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              columnId={column.id}
              title={column.title}
              color={column.color}
              tasks={column.tasks}
              onDrop={handleTaskStatusChange}
              onTaskClick={onTaskClick}
              isOverdue={isOverdue}
              moveCardWithinColumn={handleMoveCard}
              isFirstRender={isFirstRender}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
