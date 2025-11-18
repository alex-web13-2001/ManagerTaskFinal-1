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
import { compareOrderKeys } from '../utils/orderKey';
import { useKanbanDnD } from '../hooks/useKanbanDnD';
import { useTaskNewBadge } from '../hooks/useTaskNewBadge';
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
  canDrag?: boolean;
  projectCategories?: any[];
}>(({
  task,
  onClick,
  isOverdue,
  index,
  moveCard,
  isInitialRender,
  canDrag = true,
  projectCategories = [],
}, forwardedRef) => {
  const { teamMembers, categories, setIsDragging, currentUser } = useApp();
  const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | null>(null);
  
  // Check if task should show NEW badge
  const isNewTask = useTaskNewBadge(
    task.id,
    task.createdAt,
    task.userId,
    currentUser?.id || null
  );
  
  const assignee = teamMembers?.find((m) => m.id === task.assigneeId);
  // Use project categories if available, otherwise fallback to user's categories
  const availableCategories = projectCategories.length > 0 ? projectCategories : categories;
  const category = availableCategories.find((c) => c.id === task.categoryId);
  
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
    canDrag: () => canDrag,
    item: () => {
      setIsDragging(true);
      return { taskId: task.id, currentStatus: task.status, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      setIsDragging(false);
    },
  }), [canDrag, task.id, task.status, index]);

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
        layoutId={task.id}
        initial={isInitialRender ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        animate={{ 
          opacity: isDragging ? 0.5 : 1,
          scale: 1,
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ 
          opacity: { duration: 0.15 },
          scale: { duration: 0.2 },
          layout: { 
            type: 'spring',
            stiffness: 500,
            damping: 35,
            mass: 0.5
          }
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
            {isNewTask && (
              <Badge className="bg-green-500 text-white text-xs font-bold">
                NEW
              </Badge>
            )}
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

// Мемоизированная версия для оптимизации производительности
const MemoizedDraggableTaskCard = React.memo(DraggableTaskCard, (prevProps, nextProps) => {
  // If task ID changed, this is a different task - force re-render
  if (prevProps.task.id !== nextProps.task.id) {
    return false;
  }
  
  return (
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.deadline === nextProps.task.deadline &&
    prevProps.task.updatedAt === nextProps.task.updatedAt &&
    prevProps.task.categoryId === nextProps.task.categoryId &&
    prevProps.isOverdue === nextProps.isOverdue &&
    prevProps.index === nextProps.index &&
    prevProps.isInitialRender === nextProps.isInitialRender &&
    prevProps.canDrag === nextProps.canDrag &&
    prevProps.projectCategories === nextProps.projectCategories
  );
});

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
  canDrag,
  projectCategories,
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
  canDrag?: boolean;
  projectCategories?: any[];
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
        <AnimatePresence mode="popLayout">
          {tasks.map((task, index) => (
            <MemoizedDraggableTaskCard
              key={task.id}
              task={task}
              index={index}
              onClick={() => onTaskClick(task.id)}
              isOverdue={isOverdue(task.deadline)}
              moveCard={moveCardWithinColumn}
              isInitialRender={isFirstRender}
              canDrag={canDrag}
              projectCategories={projectCategories}
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
  // Track if this is the first render to avoid fade-in animation on initial load
  const [isFirstRender, setIsFirstRender] = React.useState(true);
  // Load project categories for proper category display
  const [projectCategories, setProjectCategories] = React.useState<any[]>([]);
  
  // Load project categories when project changes
  React.useEffect(() => {
    const loadProjectCategories = async () => {
      try {
        const { projectsAPI } = await import('../utils/api-client');
        const cats = await projectsAPI.getProjectCategories(projectId);
        setProjectCategories(cats);
      } catch (error) {
        console.error('Failed to load project categories for kanban:', error);
        setProjectCategories([]);
      }
    };
    
    if (projectId) {
      loadProjectCategories();
    }
  }, [projectId]);
  
  // FIX: Use simple timer-based approach like Dashboard to avoid race conditions
  // This ensures proper initialization even after registration delay
  React.useEffect(() => {
    const timer = setTimeout(() => setIsFirstRender(false), 100);
    return () => clearTimeout(timer);
  }, []);

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

      // Role-based access control: Members should only see tasks assigned to them or created by them
      if (!canViewAllProjectTasks(projectId)) {
        // Member role - only show tasks assigned to or created by current user
        const currentUserId = currentUser?.id;
        if (!currentUserId || (task.assigneeId !== currentUserId && task.userId !== currentUserId)) {
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

  // Use custom hook for DnD logic
  const { taskOrder, handleMoveCard, handleStatusChange } = useKanbanDnD({
    tasks: projectTasks,
    onUpdateTask: updateTask,
  });

  // Wrap isOverdue in useCallback for memoization
  const isOverdueMemoized = React.useCallback(isOverdue, []);

  // Group tasks by status into columns
  const columns = React.useMemo(() => {
    return columnDefinitions.map((colDef) => {
      // Все задачи (и обычные и повторяющиеся) показываем по их статусу
      const columnTasks = projectTasks.filter((task) => task.status === colDef.id);
      
      // Сортируем по orderKey для стабильного порядка
      // Используем локальный taskOrder только для оптимистичного отображения до подтверждения сервером
      const sortedTasks = [...columnTasks].sort((a, b) => {
        // Если есть локальный порядок, используем его (оптимистичное обновление)
        if (taskOrder[colDef.id]) {
          const orderA = taskOrder[colDef.id].indexOf(a.id);
          const orderB = taskOrder[colDef.id].indexOf(b.id);
          
          // Оба есть в локальном порядке
          if (orderA !== -1 && orderB !== -1) {
            return orderA - orderB;
          }
          // Только A в локальном порядке
          if (orderA !== -1) return -1;
          // Только B в локальном порядке
          if (orderB !== -1) return 1;
        }
        
        // Используем orderKey как основной источник правды
        const keyA = a.orderKey || 'n';
        const keyB = b.orderKey || 'n';
        return compareOrderKeys(keyA, keyB);
      });
      
      // Deduplicate tasks
      const seenIds = new Set<string>();
      const uniqueTasks = sortedTasks.filter(task => {
        if (seenIds.has(task.id)) return false;
        seenIds.add(task.id);
        return true;
      });
      
      return { ...colDef, tasks: uniqueTasks };
    });
  }, [projectTasks, taskOrder]);

  // Wrap handlers in useCallback for memoization
  const handleMoveCardCallback = React.useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    return handleMoveCard(draggedId, targetId, position, projectTasks);
  }, [handleMoveCard]); // Убрали projectTasks из зависимостей - хук сам получает актуальные задачи через ref

  const handleTaskClick = React.useCallback((taskId: string) => {
    onTaskClick(taskId);
  }, [onTaskClick]);

  // Проверяем, является ли пользователь участником (member) с ограниченным доступом
  const userRole = getUserRoleInProject(projectId);
  const hasLimitedAccess = userRole === 'member';
  const hasNoTasks = projectTasks.length === 0;
  
  // Only viewers cannot drag tasks (members can drag/edit their own tasks)
  const canDragTasks = userRole !== 'viewer';

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
              onDrop={handleStatusChange}
              onTaskClick={handleTaskClick}
              isOverdue={isOverdueMemoized}
              moveCardWithinColumn={handleMoveCardCallback}
              isFirstRender={isFirstRender}
              canDrag={canDragTasks}
              projectCategories={projectCategories}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
