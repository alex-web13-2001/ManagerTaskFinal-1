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
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner@2.0.3';
import { KanbanBoardSkeleton } from './kanban-skeleton';
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
}>(({
  task,
  onClick,
  isOverdue,
  index,
  moveCard,
  isInitialRender,
}, forwardedRef) => {
  const { teamMembers, currentUser } = useApp();
  const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | null>(null);
  
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
          layout: { duration: 0.2, ease: 'easeOut' }
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

export function PersonalKanbanBoard({
  filters,
  onTaskClick,
}: {
  filters: { priorities: string[]; deadline: string };
  onTaskClick: (taskId: string) => void;
}) {
  const { tasks, updateTask, currentUser, customColumns: contextCustomColumns, saveCustomColumns, isInitialLoad } = useApp();
  const [isAddingColumn, setIsAddingColumn] = React.useState(false);
  const [newColumnTitle, setNewColumnTitle] = React.useState('');
  const [editingColumnId, setEditingColumnId] = React.useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = React.useState('');
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  // Task order state to preserve drag-drop order
  const [taskOrder, setTaskOrder] = React.useState<Record<string, string[]>>({});
  // Track if this is the first render to avoid fade-in animation on initial load
  const [isFirstRender, setIsFirstRender] = React.useState(true);
  
  React.useEffect(() => {
    if (!isInitialLoad && isFirstRender) {
      setIsFirstRender(false);
    }
  }, [isInitialLoad, isFirstRender]);

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

      return true;
    });
  }, [tasks, filters]);

  // Clean up taskOrder - remove IDs that don't exist in current personal tasks
  React.useEffect(() => {
    const currentTaskIds = new Set(personalTasks.map(t => t.id));
    
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
        console.log('[PersonalKanban] Cleaning up taskOrder, removed stale IDs');
        return cleanedOrder;
      }
      
      return prev;
    });
  }, [personalTasks]);

  // Group tasks by status into columns
  const columns = React.useMemo(() => {
    return allColumnDefinitions.map((colDef) => {
      // Все задачи (и обычные и повторяющиеся) показываем по их статусу
      const columnTasks = personalTasks.filter((task) => task.status === colDef.id);
      
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
  }, [personalTasks, allColumnDefinitions, taskOrder]);

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
      console.log('[PersonalKanban] Task not found:', { draggedId, targetId });
      return;
    }

    const sourceStatus = draggedTask.status;
    const targetStatus = targetTask.status;
    
    console.log('[PersonalKanban] Moving card:', { draggedId, sourceStatus, targetStatus, position });
    
    // Update order state IMMEDIATELY for instant visual feedback
    setTaskOrder(prev => {
      const updated = { ...prev };
      
      // Get tasks for target column
      const targetColumnTasks = personalTasks
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
      
      console.log('[PersonalKanban] Updated taskOrder (deduplicated):', updated);
      return updated;
    });
    
    // If moving between columns, update status asynchronously (but don't await to avoid blocking UI)
    if (sourceStatus !== targetStatus) {
      handleTaskStatusChange(draggedId, targetStatus).catch(error => {
        console.error('[PersonalKanban] Failed to update task status:', error);
        // Optionally revert the taskOrder change here if status update fails
      });
    }
  };

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
  if (isInitialLoad) {
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
                onDrop={handleTaskStatusChange}
                onTaskClick={onTaskClick}
                isOverdue={isOverdue}
                moveCardWithinColumn={handleMoveCard}
                isCustom={isCustom}
                isFirstRender={isFirstRender}
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
