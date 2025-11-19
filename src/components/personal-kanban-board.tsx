import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Calendar, Flame, Plus, MoreHorizontal, X, Check, GripVertical, Trash2, AlertCircle, Edit2, Paperclip, Repeat } from 'lucide-react';
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
import { useDrag, useDrop } from 'react-dnd';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';
import { useProjects } from '../contexts/projects-context';
import { useUI } from '../contexts/ui-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { KanbanBoardSkeleton } from './kanban-skeleton';
import { compareOrderKeys } from '../utils/orderKey';
import { useKanbanDnD } from '../hooks/useKanbanDnD';
import { useTaskNewBadge } from '../hooks/useTaskNewBadge';
import type { Task as TaskType, CustomColumn } from '../contexts/app-context';

const ITEM_TYPE = 'PERSONAL_TASK_CARD';

// Draggable Personal Task Card Component
const DraggableTaskCard = React.forwardRef<HTMLDivElement, {
  task: TaskType;
  onClick: () => void;
  isOverdue: boolean;
  index: number;
  moveCard: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  isInitialRender: boolean;
  canDrag?: boolean;
}>(({
  task,
  onClick,
  isOverdue,
  index,
  moveCard,
  isInitialRender,
  canDrag = true,
}, forwardedRef) => {
  const { currentUser } = useAuth();
  const { teamMembers } = useProjects();
  const { setIsDragging } = useUI();
  const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | null>(null);
  
  // Check if task should show NEW badge
  const isNewTask = useTaskNewBadge(
    task.id,
    task.createdAt,
    task.userId,
    currentUser?.id || null
  );
  
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
        initial={isInitialRender ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
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
                Новая
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
                <Badge key={idx} variant="outline" className="bg-blue-100 text-blue-700">
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
    prevProps.isOverdue === nextProps.isOverdue &&
    prevProps.index === nextProps.index &&
    prevProps.isInitialRender === nextProps.isInitialRender &&
    prevProps.canDrag === nextProps.canDrag
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
  isCustom,
  onEdit,
  onDelete,
  isFirstRender,
  canDrag,
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
  onEdit?: () => void;
  onDelete?: () => void;
  isFirstRender: boolean;
  canDrag?: boolean;
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
        {isCustom && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export function PersonalKanbanBoard({
  filters,
  onTaskClick,
}: {
  filters: { priorities: string[]; deadline: string; onlyNew?: boolean };
  onTaskClick: (taskId: string) => void;
}) {
  const { currentUser, customColumns: contextCustomColumns, saveCustomColumns } = useAuth();
  const { tasks, updateTask, isLoading } = useTasks();
  const [isAddingColumn, setIsAddingColumn] = React.useState(false);
  const [newColumnTitle, setNewColumnTitle] = React.useState('');
  const [editingColumnId, setEditingColumnId] = React.useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = React.useState('');
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  // Track if this is the first render to avoid fade-in animation on initial load
  const [isFirstRender, setIsFirstRender] = React.useState(true);
  
  // FIX: Use simple timer-based approach like Dashboard to avoid race conditions
  // This ensures proper initialization even after registration delay
  React.useEffect(() => {
    const timer = setTimeout(() => setIsFirstRender(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Use custom columns from context
  const customColumns = contextCustomColumns;

  // Define base kanban columns (без review)
  const baseColumnDefinitions = React.useMemo(() => [
    { id: 'todo', title: 'К выполнению', color: 'bg-gray-500' },
    { id: 'in_progress', title: 'В работе', color: 'bg-blue-500' },
    { id: 'done', title: 'Готово', color: 'bg-green-500' },
  ], []);
  
  // Combine base and custom columns
  const allColumnDefinitions = React.useMemo(() => 
    [...baseColumnDefinitions, ...customColumns],
    [baseColumnDefinitions, customColumns]
  );

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    
    // Debug log for recurring tasks
    const task = tasks.find(t => t.deadline === deadline);
    if (task?.isRecurring) {
      console.log(`📅 isOverdue check for recurring task "${task.title}":`, {
        deadlineRaw: deadline,
        deadlineDate: deadlineDate.toISOString(),
        deadlineReadable: format(deadlineDate, 'PPP', { locale: ru }),
        todayReadable: format(today, 'PPP', { locale: ru }),
        isOverdue: deadlineDate < today,
      });
    }
    
    return deadlineDate < today;
  };

  // Helper function to check if task is new (same logic as useTaskNewBadge)
  const isTaskNew = React.useCallback((task: TaskType): boolean => {
    // Condition 1: Current user must be logged in
    if (!currentUser?.id) return false;

    // Condition 2: Task must NOT be created by current user
    if (task.userId === currentUser.id) return false;

    // Condition 3: Task must be less than 7 days old
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const taskCreatedTime = new Date(task.createdAt).getTime();
    const now = Date.now();
    const taskAge = now - taskCreatedTime;
    if (taskAge > SEVEN_DAYS_MS) return false;

    // Condition 4: Check read status and timer
    const STORAGE_KEY = 'task_views_timestamp';
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const views = stored ? JSON.parse(stored) : {};
      const viewTimestamp = views[task.id];

      // If task has been read (value is 0), don't show badge
      if (viewTimestamp === 0) return false;

      // If this is the first time seeing this task, it's new
      if (viewTimestamp === undefined) return true;

      // If task has been in view for more than 3 hours, don't show badge
      const timeSinceFirstView = now - viewTimestamp;
      if (timeSinceFirstView > THREE_HOURS_MS) return false;

      return true;
    } catch (error) {
      console.error('Failed to check task view status:', error);
      return false;
    }
  }, [currentUser?.id]);

  // Filter personal tasks (tasks without a project)
  const personalTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      // Only personal tasks (no project)
      if (task.projectId) return false;

      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
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

      // Only New filter
      if (filters.onlyNew === true) {
        if (!isTaskNew(task)) return false;
      }

      return true;
    });
  }, [tasks, filters, isTaskNew]);

  // Use custom hook for DnD logic
  const { taskOrder, handleMoveCard, handleStatusChange } = useKanbanDnD({
    tasks: personalTasks,
    onUpdateTask: updateTask,
  });

  // Wrap isOverdue in useCallback for memoization
  const isOverdueMemoized = React.useCallback(isOverdue, [tasks]);

  // Group tasks by status into columns
  const columns = React.useMemo(() => {
    return allColumnDefinitions.map((colDef) => {
      // Все задачи (и обычные и повторяющиеся) показываем по их статусу
      const columnTasks = personalTasks.filter((task) => task.status === colDef.id);
      
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
  }, [personalTasks, allColumnDefinitions, taskOrder]);

  // Wrap handlers in useCallback for memoization
  const handleMoveCardCallback = React.useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    return handleMoveCard(draggedId, targetId, position, personalTasks);
  }, [handleMoveCard]); // Убрали personalTasks из зависимостей - хук сам получает актуальные задачи через ref

  const handleTaskClick = React.useCallback((taskId: string) => {
    onTaskClick(taskId);
  }, [onTaskClick]);

  // Handle adding new column
  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    
    const colors = ['bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-indigo-500'];
    const newColumn: CustomColumn = {
      id: `custom_${Date.now()}`,
      title: newColumnTitle.trim(),
      color: colors[customColumns.length % colors.length],
    };
    
    const updatedColumns = [...customColumns, newColumn];
    console.log('Creating new column:', newColumn);
    console.log('Updated columns:', updatedColumns);
    
    await saveCustomColumns(updatedColumns);
    setNewColumnTitle('');
    setIsAddingColumn(false);
    toast.success('Столбец создан');
  };

  // Handle editing column
  const handleEditColumn = async (columnId: string) => {
    if (!editingColumnTitle.trim()) return;
    
    const updatedColumns = customColumns.map(col => 
      col.id === columnId ? { ...col, title: editingColumnTitle.trim() } : col
    );
    
    await saveCustomColumns(updatedColumns);
    setEditingColumnId(null);
    setEditingColumnTitle('');
    toast.success('Столбец обновлен');
  };

  // Handle deleting column
  const handleDeleteColumn = async (columnId: string) => {
    // Move all tasks from this column to 'todo'
    const tasksInColumn = personalTasks.filter(t => t.status === columnId);
    
    try {
      await Promise.all(
        tasksInColumn.map(task => updateTask(task.id, { status: 'todo' }))
      );
      
      const updatedColumns = customColumns.filter(col => col.id !== columnId);
      await saveCustomColumns(updatedColumns);
      setDeleteConfirmId(null);
      toast.success('Столбец удален, задачи перемещены в "К выполнению"');
    } catch (error) {
      console.error('Error deleting column:', error);
      toast.error('Ошибка при удалении столбца');
    }
  };

  // Show skeleton during initial load
  if (isLoading) {
    return <KanbanBoardSkeleton columnCount={3} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column) => {
            const isCustom = !baseColumnDefinitions.find(base => base.id === column.id);
            
            return (
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
                isCustom={isCustom}
                isFirstRender={isFirstRender}
                canDrag={true}
                onEdit={() => {
                  setEditingColumnId(column.id);
                  setEditingColumnTitle(column.title);
                }}
                onDelete={() => setDeleteConfirmId(column.id)}
              />
            );
          })}
          
          {/* Add new column button/form */}
          <div className="flex flex-col w-80 flex-shrink-0">
            {isAddingColumn ? (
              <Card className="p-4">
                <Input
                  placeholder="Название столбца"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn();
                    if (e.key === 'Escape') {
                      setIsAddingColumn(false);
                      setNewColumnTitle('');
                    }
                  }}
                  autoFocus
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddColumn}
                    disabled={!newColumnTitle.trim()}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Создать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingColumn(false);
                      setNewColumnTitle('');
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Отмена
                  </Button>
                </div>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start border-dashed border-2 hover:border-purple-400 hover:bg-purple-50"
                onClick={() => setIsAddingColumn(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить столбец
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Column Dialog */}
      <AlertDialog open={!!editingColumnId} onOpenChange={(open) => {
        if (!open) {
          setEditingColumnId(null);
          setEditingColumnTitle('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Редактировать столбец</AlertDialogTitle>
            <AlertDialogDescription>
              <Input
                placeholder="Название столбца"
                value={editingColumnTitle}
                onChange={(e) => setEditingColumnTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingColumnId) {
                    handleEditColumn(editingColumnId);
                  }
                }}
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => editingColumnId && handleEditColumn(editingColumnId)}
              disabled={!editingColumnTitle.trim()}
            >
              Сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Column Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => {
        if (!open) setDeleteConfirmId(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить столбец?</AlertDialogTitle>
            <AlertDialogDescription>
              Все задачи из этого столбца будут перемещены в "К выполнению". Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteColumn(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
