import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar, Flame, Tag, MoreHorizontal, AlertCircle, Paperclip } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useApp } from '../contexts/app-context';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Filters } from './filters-panel';
import type { Task as TaskType } from '../contexts/app-context';

type ProjectTaskTableProps = {
  projectId: string;
  searchQuery: string;
  filters: Filters;
  onTaskClick: (taskId: string) => void;
};

const priorityColors = {
  urgent: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-blue-100 text-blue-700 border-blue-300',
};

const priorityLabels = {
  urgent: '🔥 Срочный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const statusColors = {
  todo: 'bg-gray-100 text-gray-700 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
  review: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  done: 'bg-green-100 text-green-700 border-green-300',
};

const statusLabels = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Готово',
};

// Categories are now loaded from the app context

export function ProjectTaskTable({ projectId, searchQuery, filters, onTaskClick }: ProjectTaskTableProps) {
  const { tasks, updateTask, deleteTask, teamMembers, currentUser, canEditTask, canDeleteTask, categories, canViewAllProjectTasks } = useApp();

  // Filter tasks for this project
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      // Must be from this project
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
            if (!isToday(deadline)) return false;
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

      return true;
    });
  }, [tasks, projectId, searchQuery, filters, canViewAllProjectTasks, currentUser]);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return '—';
    const date = new Date(deadline);
    if (isToday(date)) return 'Сегодня';
    if (isTomorrow(date)) return 'Завтра';
    return format(date, 'dd MMM', { locale: ru });
  };

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    return isPast(new Date(deadline)) && !isToday(new Date(deadline));
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await updateTask(taskId, { 
      status: newStatus,
      completed: newStatus === 'done',
    });
  };

  const handleDelete = async (taskId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
      await deleteTask(taskId);
    }
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Нет задач, соответствующих фильтрам</p>
          <p className="text-sm text-gray-500">
            {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Попробуйте изменить фильтры'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[250px]">Задача</TableHead>
              <TableHead className="w-[180px]">Статус</TableHead>
              <TableHead>Приоритет</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Исполнитель</TableHead>
              <TableHead>Дедлайн</TableHead>
              <TableHead>Теги</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => {
              const assignee = teamMembers?.find((m) => m.id === task.assigneeId);
              const category = categories.find((c) => c.id === task.categoryId);
              const overdue = isOverdue(task.deadline);
              const userCanEdit = canEditTask(task);
              const userCanDelete = canDeleteTask(task);

              return (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={(e) => {
                    // Не открываем модальное окно, если клик был по Select или его дочерним элементам
                    const target = e.target as HTMLElement;
                    if (target.closest('[role="combobox"]') || target.closest('[role="option"]')) {
                      return;
                    }
                    onTaskClick(task.id);
                  }}
                >
                  <TableCell>
                    <div className="max-w-[300px] flex items-center gap-2">
                      <span className={`truncate ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                        {task.title}
                      </span>
                      {task.attachments && task.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{task.attachments.length}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {userCanEdit ? (
                      <Select
                        value={task.status}
                        onValueChange={(value) => handleStatusChange(task.id, value)}
                      >
                        <SelectTrigger className={`h-8 ${statusColors[task.status as keyof typeof statusColors]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">{statusLabels.todo}</SelectItem>
                          <SelectItem value="in_progress">{statusLabels.in_progress}</SelectItem>
                          <SelectItem value="review">{statusLabels.review}</SelectItem>
                          <SelectItem value="done">{statusLabels.done}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={statusColors[task.status as keyof typeof statusColors]}>
                        {statusLabels[task.status as keyof typeof statusLabels]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[task.priority as keyof typeof priorityColors]}>
                      {priorityLabels[task.priority as keyof typeof priorityLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {category ? (
                      <Badge 
                        variant="secondary" 
                        className={`${category.color} text-white border-0`}
                      >
                        {category.name}
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate max-w-[120px]" title={assignee.name}>
                          {assignee.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Не назначен</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {overdue && <AlertCircle className="w-4 h-4 text-red-500" />}
                      <span className={overdue ? 'text-red-600' : task.deadline ? '' : 'text-gray-400'}>
                        {formatDeadline(task.deadline)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.tags && task.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.slice(0, 2).map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {task.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{task.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onTaskClick(task.id)}>
                          Открыть
                        </DropdownMenuItem>
                        {userCanDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(task.id)}
                              className="text-red-600"
                            >
                              Удалить
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
