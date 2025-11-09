import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { MoreHorizontal, Calendar, Flame, Tag, User, AlertCircle, Info, Paperclip, Repeat } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useDrag, useDrop } from 'react-dnd';
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import type { Filters } from './filters-panel';
import type { Task as TaskType } from '../contexts/app-context';

const ITEM_TYPE = 'TASK_CARD';

// Статусы доступные для личных задач (задачи без проекта)
const PERSONAL_TASK_ALLOWED_STATUSES = ['todo', 'in_progress', 'done'];

// Draggable Task Card Component
const DraggableTaskCard = React.forwardRef<HTMLDivElement, {
  task: TaskType;
  onClick: () => void;
  isOverdue: boolean;
  index: number;
  moveCard: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  allTasks: TaskType[];
  baseColumnDefinitions: { id: string; title: string; color: string }[];
}>(({
  task,
  onClick,
  isOverdue,
  index,
  moveCard,
  allTasks,
  baseColumnDefinitions,
}, forwardedRef) => {
  const { projects, teamMembers, categories } = useApp();
  const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | null>(null);
  const [canDropHere, setCanDropHere] = React.useState(true);
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE,
    item: { taskId: task.id, currentStatus: task.status, index, hasProjectId: !!task.projectId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    hover: (item: { taskId: string; currentStatus: string; index: number; hasProjectId?: boolean }, monitor) => {
      if (item.taskId === task.id) return;
      
      // Проверяем, можно ли перетащить задачу на эту позицию
      const draggedTask = allTasks.find(t => t.id === item.taskId);
      const isTargetCustom = !baseColumnDefinitions.find(base => base.id === task.status);
      
      // Проверка 1: Задачи из проектов не могут быть в кастомных столбцах
      let allowed = !(isTargetCustom && draggedTask?.projectId);
      
      // Проверка 2: Личные задачи (без projectId) не могут быть в недоступных базовых статусах
      if (allowed && draggedTask && !draggedTask.projectId && !isTargetCustom) {
        // Это базовый столбец, проверяем доступность для личных задач
        if (!PERSONAL_TASK_ALLOWED_STATUSES.includes(task.status)) {
          allowed = false;
        }
      }
      
      setCanDropHere(allowed);
      
      const hoverBoundingRect = (monitor.getClientOffset());
      const hoverMiddleY = hoverBoundingRect ? hoverBoundingRect.y : 0;
      
      // Determine position based on hover location
      const cardElement = document.getElementById(`task-card-${task.id}`);
      if (cardElement) {
        const cardRect = cardElement.getBoundingClientRect();
        const cardMiddleY = (cardRect.top + cardRect.bottom) / 2;
        setDropPosition(hoverMiddleY < cardMiddleY ? 'before' : 'after');
      }
    },
    drop: (item: { taskId: string; currentStatus: string; hasProjectId?: boolean }) => {
      if (item.taskId !== task.id && dropPosition && canDropHere) {
        moveCard(item.taskId, task.id, dropPosition);
      }
      setDropPosition(null);
      setCanDropHere(true);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [dropPosition, allTasks, baseColumnDefinitions, canDropHere]);

  const combinedRef = (node: HTMLDivElement | null) => {
    drag(node);
    drop(node);
  };

  const category = categories.find((c) => c.id === task.categoryId);
  const project = projects?.find((p) => p.id === task.projectId);
  const assignee = teamMembers?.find((m) => m.id === task.assigneeId);
  
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-500',
      green: 'bg-green-500',
      pink: 'bg-pink-500',
      orange: 'bg-orange-500',
      blue: 'bg-blue-500',
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
      indigo: 'bg-indigo-500',
    };
    return colorMap[color || ''] || 'bg-gray-500';
  };

  return (
    <div className="relative">
      {isOver && dropPosition === 'before' && (
        <div className={`absolute -top-1 left-0 right-0 h-0.5 ${canDropHere ? 'bg-purple-500' : 'bg-red-500'} rounded-full z-10`}>
          <div className={`absolute -left-1 -top-1 w-2 h-2 ${canDropHere ? 'bg-purple-500' : 'bg-red-500'} rounded-full`} />
          <div className={`absolute -right-1 -top-1 w-2 h-2 ${canDropHere ? 'bg-purple-500' : 'bg-red-500'} rounded-full`} />
        </div>
      )}
      
      <motion.div
        id={`task-card-${task.id}`}
        ref={combinedRef}
        layout
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: isDragging ? 0.4 : 1,
        }}
        exit={{ opacity: 0 }}
        transition={{ 
          duration: 0.1,
          ease: 'linear',
          layout: { duration: 0.2 }
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
        <CardContent className="pt-4 pb-3 space-y-3">
          {/* Проект сверху */}
          <div className="flex items-center gap-2">
            {project ? (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <div className={`w-2 h-2 rounded-full ${getColorClass(project.color)} mr-1`} />
                {project.name}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                <User className="w-3 h-3 mr-1" />
                Личные задачи
              </Badge>
            )}
          </div>

          {/* Заголовок */}
          <div className="flex items-center gap-2">
            {task.isRecurring && (
              <Repeat className="w-4 h-4 text-purple-600 flex-shrink-0" />
            )}
            <h4 className={`flex-1 ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </h4>
          </div>

          {/* Категория и приоритет */}
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
          </div>

          {/* Теги */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0 bg-gray-100 text-gray-700">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-gray-200 text-gray-600">
                  +{task.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Дедлайн, Файлы и Исполнитель */}
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
      <div className={`absolute -bottom-1 left-0 right-0 h-0.5 ${canDropHere ? 'bg-purple-500' : 'bg-red-500'} rounded-full z-10`}>
        <div className={`absolute -left-1 -top-1 w-2 h-2 ${canDropHere ? 'bg-purple-500' : 'bg-red-500'} rounded-full`} />
        <div className={`absolute -right-1 -top-1 w-2 h-2 ${canDropHere ? 'bg-purple-500' : 'bg-red-500'} rounded-full`} />
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
  isCustom = false,
  allTasks,
  baseColumnDefinitions,
}: {
  columnId: string;
  title: string;
  color: string;
  tasks: TaskType[];
  onDrop: (taskId: string, newStatus: string) => void;
  onTaskClick: (taskId: string) => void;
  isOverdue: (deadline?: string) => boolean;
  moveCardWithinColumn: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  isCustom?: boolean;
  allTasks: TaskType[];
  baseColumnDefinitions: { id: string; title: string; color: string }[];
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    canDrop: (item: { taskId: string; currentStatus: string; hasProjectId?: boolean }) => {
      const task = allTasks.find(t => t.id === item.taskId);
      if (!task) return false;
      
      // Проверка 1: Если это кастомный столбец, проверяем, что задача личная (без projectId)
      if (isCustom) {
        // Запрещаем перетаскивание задач с projectId в кастомные столбцы
        if (task.projectId) {
          return false;
        }
      }
      
      // Проверка 2: Если это базовый столбец и задача личная (без projectId)
      if (!isCustom && !task.projectId) {
        // Проверяем, доступен ли этот статус для личных задач
        if (!PERSONAL_TASK_ALLOWED_STATUSES.includes(columnId)) {
          return false;
        }
      }
      
      return true;
    },
    drop: (item: { taskId: string; currentStatus: string; hasProjectId?: boolean }, monitor) => {
      // Only trigger if dropped on empty space (not on a card)
      const didDrop = monitor.didDrop();
      if (!didDrop && item.currentStatus !== columnId) {
        onDrop(item.taskId, columnId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [isCustom, allTasks]);

  // Проверяем, является ли этот столбец недоступным для личных задач
  const isProjectOnlyColumn = !isCustom && !PERSONAL_TASK_ALLOWED_STATUSES.includes(columnId);

  return (
    <div ref={drop} className="flex flex-col w-80 flex-shrink-0">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="text-gray-900">{title}</h3>
        {isCustom && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-300 cursor-help">
                  <Info className="w-3 h-3 mr-0.5" />
                  личный
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">Только личные задачи (без проекта) могут быть перемещены в этот столбец</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isProjectOnlyColumn && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-300 cursor-help">
                  <Info className="w-3 h-3 mr-0.5" />
                  проект
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">Только задачи из проектов могут использовать этот статус</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Badge variant="secondary" className="ml-auto">
          {tasks.length}
        </Badge>
      </div>

      <div
        className={`flex-1 space-y-3 overflow-y-auto p-3 rounded-lg transition-colors duration-150 ${
          isOver && canDrop ? 'bg-purple-50 ring-2 ring-purple-300' : 
          isOver && !canDrop ? 'bg-red-50 ring-2 ring-red-300' : 
          'bg-transparent'
        }`}
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
              allTasks={allTasks}
              baseColumnDefinitions={baseColumnDefinitions}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

type GroupBy = 'none' | 'project' | 'priority';

export function KanbanBoard({
  searchQuery,
  filters,
  onTaskClick,
  showCustomColumns = false,
}: {
  searchQuery: string;
  filters: Filters;
  onTaskClick: (taskId: string) => void;
  showCustomColumns?: boolean;
}) {
  const { tasks, updateTask, customColumns } = useApp();
  const [groupBy, setGroupBy] = React.useState<GroupBy>('none');
  const [taskOrder, setTaskOrder] = React.useState<Record<string, string[]>>({});

  // Define base kanban columns
  const baseColumnDefinitions = React.useMemo(() => [
    { id: 'todo', title: 'К выполнению', color: 'bg-gray-500' },
    { id: 'in_progress', title: 'В работе', color: 'bg-blue-500' },
    { id: 'review', title: 'На проверке', color: 'bg-yellow-500' },
    { id: 'done', title: 'Готово', color: 'bg-green-500' },
  ], []);

  // Combine base and custom columns if showCustomColumns is true
  const columnDefinitions = React.useMemo(() => {
    console.log('[Dashboard] showCustomColumns:', showCustomColumns, 'customColumns:', customColumns);
    if (showCustomColumns && customColumns.length > 0) {
      console.log('[Dashboard] Showing custom columns:', customColumns);
      return [...baseColumnDefinitions, ...customColumns];
    }
    console.log('[Dashboard] Showing only base columns');
    return baseColumnDefinitions;
  }, [baseColumnDefinitions, customColumns, showCustomColumns]);

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(deadline) < today;
  };

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    const result = tasks.filter((task) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Filters
      if (filters.projects.length > 0) {
        const projectMatch = filters.projects.includes(task.projectId || 'personal');
        if (!projectMatch) return false;
      }
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
      if (filters.assignees.length > 0) {
        // Фильтр по исполнителям: проверяем assigneeId
        if (!task.assigneeId || !filters.assignees.includes(task.assigneeId)) {
          return false;
        }
      }
      if (filters.tags.length > 0 && task.tags) {
        const hasTag = filters.tags.some((tag) => task.tags.includes(tag));
        if (!hasTag) return false;
      }

      // Deadline filter
      if (filters.deadline !== 'all') {
        // Если у задачи нет дедлайна, исключаем её из фильтров дедлайна
        if (!task.deadline) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const taskDeadline = new Date(task.deadline);
        taskDeadline.setHours(0, 0, 0, 0);

        if (filters.deadline === 'overdue') {
          // Просрочено - deadline < сегодня
          if (taskDeadline >= today) return false;
        } else if (filters.deadline === 'today') {
          // Сегодня - deadline === сегодня
          if (taskDeadline.getTime() !== today.getTime()) return false;
        } else if (filters.deadline === '3days') {
          // 3 дня - deadline в течение следующих 3 дней (включая сегодня)
          const threeDaysFromNow = new Date(today);
          threeDaysFromNow.setDate(today.getDate() + 3);
          if (taskDeadline < today || taskDeadline > threeDaysFromNow) return false;
        } else if (filters.deadline === 'week') {
          // На этой неделе - deadline до конца текущей недели (воскресенье)
          const endOfWeek = new Date(today);
          const dayOfWeek = today.getDay(); // 0 = Воскресенье, 1 = Понедельник, ...
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          endOfWeek.setDate(today.getDate() + daysUntilSunday);
          if (taskDeadline < today || taskDeadline > endOfWeek) return false;
        }
      }

      return true;
    });
    
    console.log('[KanbanBoard] Filtering results:', {
      totalTasks: tasks.length,
      filteredTasks: result.length,
      filters,
      searchQuery,
    });
    
    return result;
  }, [tasks, searchQuery, filters]);

  // Clean up taskOrder - remove IDs that don't exist in current filtered tasks
  React.useEffect(() => {
    const currentTaskIds = new Set(filteredTasks.map(t => t.id));
    
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
        console.log('[KanbanBoard] Cleaning up taskOrder, removed stale IDs');
        return cleanedOrder;
      }
      
      return prev;
    });
  }, [filteredTasks]);

  // Group tasks by status into columns
  const columns = React.useMemo(() => {
    console.log('[Dashboard] Recalculating columns with columnDefinitions:', columnDefinitions.length);
    return columnDefinitions.map((colDef) => {
      // Все задачи (и обычные и повторяющиеся) показываем по их статусу
      const columnTasks = filteredTasks.filter((task) => task.status === colDef.id);
      
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
  }, [columnDefinitions, filteredTasks, taskOrder]);

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
  const handleMoveCard = (draggedId: string, targetId: string, position: 'before' | 'after') => {
    const draggedTask = tasks.find(t => t.id === draggedId);
    const targetTask = tasks.find(t => t.id === targetId);
    
    if (!draggedTask || !targetTask) {
      console.log('[KanbanBoard] Task not found:', { draggedId, targetId });
      return;
    }

    const sourceStatus = draggedTask.status;
    const targetStatus = targetTask.status;
    
    console.log('[KanbanBoard] Moving card:', { draggedId, sourceStatus, targetStatus, position });
    
    // Проверяем, является ли целевой столбец кастомным
    const isTargetCustom = !baseColumnDefinitions.find(base => base.id === targetStatus);
    
    // Проверка 1: Если целевой столбец кастомный и задача из проекта - запрещаем перемещение
    if (isTargetCustom && draggedTask.projectId) {
      console.log('[KanbanBoard] Cannot move project task to custom column');
      return;
    }
    
    // Проверка 2: Если задача личная и целевой столбец базовый, проверяем доступность статуса
    if (!draggedTask.projectId && !isTargetCustom) {
      if (!PERSONAL_TASK_ALLOWED_STATUSES.includes(targetStatus)) {
        console.log('[KanbanBoard] Cannot move personal task to unavailable status:', targetStatus);
        return;
      }
    }
    
    // Update task status immediately if moving between columns
    if (sourceStatus !== targetStatus) {
      handleTaskStatusChange(draggedId, targetStatus);
    }
    
    // Update order state
    setTaskOrder(prev => {
      const updated = { ...prev };
      
      // Get tasks for target column (будет включать перемещенную задачу после обновления статуса)
      const targetColumnTasks = filteredTasks
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
      
      console.log('[KanbanBoard] Updated taskOrder (deduplicated):', updated);
      return updated;
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Группировка (пока отключена) */}
      {/* <div className="flex items-center gap-4 px-4 md:px-6 py-3 border-b bg-white">
        <Label htmlFor="group-by" className="text-sm">
          Группировать по:
        </Label>
        <Switch
          id="group-by"
          checked={groupBy !== 'none'}
          onCheckedChange={(checked) => setGroupBy(checked ? 'project' : 'none')}
        />
        <span className="text-sm text-gray-600">
          {groupBy === 'none' ? 'Без группировки' : 'По проектам'}
        </span>
      </div> */}

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column) => {
            const isCustom = !baseColumnDefinitions.find(base => base.id === column.id);
            console.log('[Dashboard] Rendering column:', column.id, column.title, 'isCustom:', isCustom, 'tasks:', column.tasks.length);
            return (
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
                isCustom={isCustom}
                allTasks={tasks}
                baseColumnDefinitions={baseColumnDefinitions}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
