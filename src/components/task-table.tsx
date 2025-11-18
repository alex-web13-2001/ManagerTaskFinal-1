import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ArrowUpDown, ArrowUp, ArrowDown, Flame, Tag, User, Paperclip } from 'lucide-react';
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useTaskNewBadge } from '../hooks/useTaskNewBadge';
import type { Filters } from './filters-panel';
import type { Task as TaskType } from '../contexts/app-context';

// Helper component to show NEW badge in table (uses hook inside)
function NewTaskBadge({ task, currentUserId }: { task: TaskType; currentUserId: string | null }) {
  const isNew = useTaskNewBadge(task.id, task.createdAt, task.userId, currentUserId);
  
  if (!isNew) return null;
  
  return (
    <Badge className="bg-green-500 text-white text-xs font-bold ml-2">
      Новая
    </Badge>
  );
}

// Categories are now loaded from the app context via useApp hook

const statusColors = {
  'todo': 'bg-gray-100 text-gray-700',
  'in_progress': 'bg-blue-100 text-blue-700',
  'review': 'bg-yellow-100 text-yellow-700',
  'done': 'bg-green-100 text-green-700',
};

const statusLabels = {
  'todo': 'К выполнению',
  'in_progress': 'В работе',
  'review': 'На проверке',
  'done': 'Готово',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
  urgent: 'bg-orange-100 text-orange-700',
};

const priorityLabels = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

type SortColumn = 'title' | 'project' | 'category' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'updatedAt';
type SortDirection = 'asc' | 'desc' | null;

type TaskTableProps = {
  searchQuery: string;
  filters: Filters;
  onTaskClick: (taskId: string) => void;
};

export function TaskTable({ searchQuery, filters, onTaskClick }: TaskTableProps) {
  const { tasks, projects, teamMembers, currentUser, customColumns, updateTask, categories, canViewAllProjectTasks } = useApp();
  const [sortColumn, setSortColumn] = React.useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);

  // Log custom columns on mount and when they change
  React.useEffect(() => {
    console.log('[TaskTable] Custom columns updated:', {
      count: customColumns.length,
      columns: customColumns,
      taskStatuses: tasks.map(t => t.status).filter((s, i, arr) => arr.indexOf(s) === i),
    });
  }, [customColumns, tasks]);

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    const dueDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Get all available statuses for a task (base + custom for personal tasks)
  const getAvailableStatuses = (task: TaskType) => {
    const baseStatuses = task.projectId 
      ? ['todo', 'in_progress', 'review', 'done'] // Project tasks have review
      : ['todo', 'in_progress', 'done']; // Personal tasks don't have review by default
    
    console.log('[TaskTable] getAvailableStatuses for task:', {
      taskId: task.id,
      taskTitle: task.title,
      hasProject: !!task.projectId,
      baseStatuses,
      customColumnsCount: customColumns.length,
      customColumns: customColumns.map(c => ({ id: c.id, title: c.title }))
    });
    
    // If it's a personal task, add custom columns
    if (!task.projectId) {
      const statuses = [
        ...baseStatuses.map(id => ({
          id,
          label: statusLabels[id as keyof typeof statusLabels],
          color: statusColors[id as keyof typeof statusColors],
        })),
        ...customColumns.map(col => ({
          id: col.id,
          label: col.title,
          color: 'bg-purple-100 text-purple-700',
        })),
      ];
      console.log('[TaskTable] Personal task statuses:', statuses);
      return statuses;
    }
    
    const statuses = baseStatuses.map(id => ({
      id,
      label: statusLabels[id as keyof typeof statusLabels],
      color: statusColors[id as keyof typeof statusColors],
    }));
    console.log('[TaskTable] Project task statuses:', statuses);
    return statuses;
  };

  // Get status display info
  const getStatusInfo = (status: string) => {
    if (statusLabels[status as keyof typeof statusLabels]) {
      return {
        label: statusLabels[status as keyof typeof statusLabels],
        color: statusColors[status as keyof typeof statusColors],
      };
    }
    
    const customColumn = customColumns.find(col => col.id === status);
    if (customColumn) {
      return {
        label: customColumn.title,
        color: 'bg-purple-100 text-purple-700',
      };
    }
    
    // If no custom column found, show a warning and fallback
    console.warn('[TaskTable] No label found for status:', status, {
      availableCustomColumns: customColumns,
      customColumnsCount: customColumns.length,
      statusType: typeof status,
      note: 'Custom columns may not be loaded yet - will refresh via polling',
    });
    
    // Fallback: display the status ID with a more descriptive label
    // Extract a readable name from the custom ID if possible
    let fallbackLabel = status;
    if (status.startsWith('custom_')) {
      // Show "Загрузка..." to indicate the column info is being fetched
      fallbackLabel = 'Загрузка статуса...';
    }
    
    return {
      label: fallbackLabel,
      color: 'bg-purple-100 text-purple-700', // Use purple to match custom columns
    };
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus }, { silent: true });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
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

  const filteredAndSortedTasks = React.useMemo(() => {
    console.log('[TaskTable] Starting filtration with:', {
      totalTasks: tasks.length,
      searchQuery,
      filters,
      firstTasksPreview: tasks.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        status: t.status,
        priority: t.priority
      }))
    });
    
    const debugLog: any[] = [];
    
    const filterTasks = (task: TaskType, index: number) => {
      const debug = {
        taskIndex: index,
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        passed: true,
        reason: '',
      };
      
      // Role-based access control: Members should only see tasks assigned to them or created by them
      if (task.projectId) {
        if (!canViewAllProjectTasks(task.projectId)) {
          // Member role - only show tasks assigned to or created by current user
          const currentUserId = currentUser?.id;
          if (!currentUserId || (task.assigneeId !== currentUserId && task.userId !== currentUserId)) {
            debug.passed = false;
            debug.reason = 'role-based access control';
            debugLog.push(debug);
            return false;
          }
        }
      }
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query)) {
          debug.passed = false;
          debug.reason = 'search query';
          debugLog.push(debug);
          return false;
        }
      }

      // Project filter
      if (filters.projects.length > 0) {
        const projectMatch = filters.projects.includes(task.projectId || 'personal');
        if (!projectMatch) {
          debug.passed = false;
          debug.reason = 'project filter';
          debugLog.push(debug);
          return false;
        }
      }

      // Category filter
      if (filters.categories.length > 0) {
        const taskCategory = task.categoryId || 'none';
        if (!filters.categories.includes(taskCategory)) {
          debug.passed = false;
          debug.reason = 'category filter';
          debugLog.push(debug);
          return false;
        }
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        debug.passed = false;
        debug.reason = 'status filter';
        debugLog.push(debug);
        return false;
      }

      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        debug.passed = false;
        debug.reason = 'priority filter';
        debugLog.push(debug);
        return false;
      }

      // Assignee filter
      if (filters.assignees.length > 0) {
        // Special case: 'me' filter
        if (filters.assignees.includes('me')) {
          if (task.assigneeId !== currentUser?.id) {
            debug.passed = false;
            debug.reason = 'assignee filter (me)';
            debugLog.push(debug);
            return false;
          }
        } else if (!filters.assignees.includes(task.assigneeId || '')) {
          debug.passed = false;
          debug.reason = 'assignee filter';
          debugLog.push(debug);
          return false;
        }
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const hasTag = filters.tags.some((tag) => task.tags?.includes(tag));
        if (!hasTag) {
          debug.passed = false;
          debug.reason = 'tags filter';
          debugLog.push(debug);
          return false;
        }
      }

      // Deadline filter
      if (filters.deadline !== 'all') {
        // Если у задачи нет дедлайна, исключаем её из фильтров дедлайна
        if (!task.deadline) {
          debug.passed = false;
          debug.reason = 'deadline filter (no deadline)';
          debugLog.push(debug);
          return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const taskDeadline = new Date(task.deadline);
        taskDeadline.setHours(0, 0, 0, 0);

        if (filters.deadline === 'overdue') {
          // Просрочено - deadline < сегодня
          if (taskDeadline >= today) {
            debug.passed = false;
            debug.reason = 'deadline filter (not overdue)';
            debugLog.push(debug);
            return false;
          }
        } else if (filters.deadline === 'today') {
          // Сегодня - deadline === сегодня
          if (taskDeadline.getTime() !== today.getTime()) {
            debug.passed = false;
            debug.reason = 'deadline filter (not today)';
            debugLog.push(debug);
            return false;
          }
        } else if (filters.deadline === '3days') {
          // 3 дня - deadline в течение следующих 3 дней (включая сегодня)
          const threeDaysFromNow = new Date(today);
          threeDaysFromNow.setDate(today.getDate() + 3);
          if (taskDeadline < today || taskDeadline > threeDaysFromNow) {
            debug.passed = false;
            debug.reason = 'deadline filter (not in 3 days)';
            debugLog.push(debug);
            return false;
          }
        } else if (filters.deadline === 'week') {
          // На этой неделе - deadline до конца текущей недели (воскресенье)
          const endOfWeek = new Date(today);
          const dayOfWeek = today.getDay(); // 0 = Воскресенье, 1 = Понедельник, ...
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          endOfWeek.setDate(today.getDate() + daysUntilSunday);
          if (taskDeadline < today || taskDeadline > endOfWeek) {
            debug.passed = false;
            debug.reason = 'deadline filter (not this week)';
            debugLog.push(debug);
            return false;
          }
        }
      }

      // Only New filter
      if (filters.onlyNew === true) {
        if (!isTaskNew(task)) {
          debug.passed = false;
          debug.reason = 'onlyNew filter (task is not new)';
          debugLog.push(debug);
          return false;
        }
      }

      debugLog.push(debug);
      return true;
    };

    let result = tasks.filter(filterTasks);

    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case 'title':
            aVal = a.title || '';
            bVal = b.title || '';
            break;
          case 'project':
            const aProject = projects?.find(p => p.id === a.projectId);
            const bProject = projects?.find(p => p.id === b.projectId);
            aVal = aProject?.name || 'Личные задачи';
            bVal = bProject?.name || 'Личные задачи';
            break;
          case 'category':
            const aCategory = categories.find(c => c.id === a.categoryId);
            const bCategory = categories.find(c => c.id === b.categoryId);
            aVal = aCategory?.name || '';
            bVal = bCategory?.name || '';
            break;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          case 'priority':
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            aVal = priorityOrder[a.priority];
            bVal = priorityOrder[b.priority];
            break;
          case 'assignee':
            const aAssignee = teamMembers?.find(m => m.id === a.assigneeId);
            const bAssignee = teamMembers?.find(m => m.id === b.assigneeId);
            aVal = aAssignee?.name || '';
            bVal = bAssignee?.name || '';
            break;
          case 'dueDate':
            aVal = a.deadline ? new Date(a.deadline) : new Date(0);
            bVal = b.deadline ? new Date(b.deadline) : new Date(0);
            break;
          case 'updatedAt':
            aVal = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
            bVal = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
            break;
          default:
            aVal = '';
            bVal = '';
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    console.log('[TaskTable] Filtering results:', {
      totalTasks: tasks.length,
      filteredTasks: result.length,
      filters,
      searchQuery,
      rejectedTasks: debugLog.filter(d => !d.passed),
      acceptedTasks: debugLog.filter(d => d.passed).slice(0, 5),
    });
    
    // Log first 10 rejected tasks for debugging
    const rejected = debugLog.filter(d => !d.passed);
    if (rejected.length > 0) {
      console.log('[TaskTable] First 10 rejected tasks:', rejected.slice(0, 10));
    }
    
    return result;
  }, [tasks, projects, teamMembers, currentUser, searchQuery, filters, sortColumn, sortDirection, customColumns, isTaskNew]);



  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 ml-1 text-purple-600" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1 text-purple-600" />
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  console.log('[TaskTable] Rendering with:', {
    filteredTasksCount: filteredAndSortedTasks.length,
    firstFewTasks: filteredAndSortedTasks.slice(0, 3).map(t => ({ id: t.id, title: t.title, projectId: t.projectId })),
  });

  return (
    <div className="flex-1 overflow-auto bg-white">
      <table className="w-full caption-bottom text-sm">
        <thead className="[&_tr]:border-b sticky top-0 bg-white z-10 shadow-sm">
          <tr className="border-b transition-colors">
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('title')}
              >
                Задача
                <SortIcon column="title" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('project')}
              >
                Проект
                <SortIcon column="project" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('category')}
              >
                Категория
                <SortIcon column="category" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('status')}
              >
                Статус
                <SortIcon column="status" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('priority')}
              >
                Приоритет
                <SortIcon column="priority" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('assignee')}
              >
                Исполнитель
                <SortIcon column="assignee" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('dueDate')}
              >
                Дедлайн
                <SortIcon column="dueDate" />
              </button>
            </th>
            <th className="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('updatedAt')}
              >
                Обновлено
                <SortIcon column="updatedAt" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {filteredAndSortedTasks.length === 0 ? (
            <tr className="border-b transition-colors">
              <td colSpan={8} className="p-2 align-middle text-center text-gray-500 py-8">
                {searchQuery || filters.projects.length > 0 || filters.statuses.length > 0
                  ? 'Задачи не найдены'
                  : 'Нет задач для отображения'}
              </td>
            </tr>
          ) : (
            filteredAndSortedTasks.map((task) => {
              const overdue = isOverdue(task.deadline);
              const project = projects?.find(p => p.id === task.projectId);
              const category = categories.find(c => c.id === task.categoryId);
              const assignee = teamMembers?.find(m => m.id === task.assigneeId);

              return (
                <tr
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50 border-b transition-colors"
                  onClick={() => onTaskClick(task.id)}
                >
                  <td className="p-2 align-middle whitespace-nowrap">
                    <div className="max-w-md flex items-center gap-2">
                      <p className={`truncate ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                        {task.title}
                      </p>
                      <NewTaskBadge task={task} currentUserId={currentUser?.id || null} />
                      {task.attachments && task.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{task.attachments.length}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
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
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    {category && category.id !== 'none' && (
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        <Tag className="w-3 h-3 mr-1" />
                        {category.name}
                      </Badge>
                    )}
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={task.status}
                      onValueChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                    >
                      <SelectTrigger className="w-[160px] h-8 border-0 focus:ring-0 bg-transparent">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getStatusInfo(task.status).color}>
                            {getStatusInfo(task.status).label}
                          </Badge>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableStatuses(task).map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <Badge variant="outline" className={status.color}>
                              {status.label}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority === 'urgent' && (
                        <Flame className="w-3 h-3 mr-1 fill-current" />
                      )}
                      {priorityLabels[task.priority]}
                    </Badge>
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {assignee.avatarUrl && (
                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                          )}
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                            {getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-gray-700 truncate max-w-[120px]">
                          {assignee.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    {task.deadline ? (
                      <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {format(new Date(task.deadline), 'dd MMM yyyy', { locale: ru })}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    {task.updatedAt ? (
                      <span className="text-sm text-gray-500">
                        {format(new Date(task.updatedAt), 'dd MMM HH:mm', { locale: ru })}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
