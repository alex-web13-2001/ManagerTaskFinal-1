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
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Flame, Paperclip, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Task as TaskType } from '../contexts/app-context';

const baseStatusColors: Record<string, string> = {
  'todo': 'bg-gray-100 text-gray-700',
  'in_progress': 'bg-blue-100 text-blue-700',
  'done': 'bg-green-100 text-green-700',
};

const baseStatusLabels: Record<string, string> = {
  'todo': 'К выполнению',
  'in_progress': 'В работе',
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

type SortColumn = 'title' | 'status' | 'priority' | 'dueDate' | 'updatedAt';
type SortDirection = 'asc' | 'desc' | null;

type PersonalTaskTableProps = {
  filters: {
    priorities: string[];
    deadline: string;
  };
  onTaskClick: (taskId: string) => void;
};

export function PersonalTaskTable({ filters, onTaskClick }: PersonalTaskTableProps) {
  const { tasks, currentUser, teamMembers, customColumns, deleteTask, canDeleteTask } = useApp();
  const [sortColumn, setSortColumn] = React.useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);

  const handleDelete = async (taskId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту задачу?')) {
      try {
        await deleteTask(taskId);
      } catch (error) {
        console.error('Failed to delete task:', error);
      }
    }
  };

  // Build dynamic status colors and labels
  const statusColors = React.useMemo(() => {
    const colors = { ...baseStatusColors };
    customColumns.forEach(col => {
      colors[col.id] = 'bg-purple-100 text-purple-700'; // Default color for custom columns
    });
    return colors;
  }, [customColumns]);

  const statusLabels = React.useMemo(() => {
    const labels = { ...baseStatusLabels };
    customColumns.forEach(col => {
      labels[col.id] = col.title;
    });
    return labels;
  }, [customColumns]);

  // Получаем личные задачи (где assigneeId = currentUser.id)
  const personalTasks = React.useMemo(() => {
    return tasks.filter(task => 
      !task.projectId && task.assigneeId === currentUser?.id
    );
  }, [tasks, currentUser]);

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    const dueDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const filteredAndSortedTasks = React.useMemo(() => {
    const filterTasks = (task: TaskType) => {
      // Фильтр по приоритету
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
      }

      // Фильтр по дедлайну
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
    };

    let result = personalTasks.filter(filterTasks);

    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        let aVal: any = a[sortColumn];
        let bVal: any = b[sortColumn];

        // Handle date columns
        if (sortColumn === 'dueDate') {
          aVal = a.deadline ? new Date(a.deadline) : new Date(0);
          bVal = b.deadline ? new Date(b.deadline) : new Date(0);
        } else if (sortColumn === 'updatedAt') {
          aVal = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
          bVal = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
        }

        // Handle priority
        if (sortColumn === 'priority') {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority];
          bVal = priorityOrder[b.priority];
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [personalTasks, filters, sortColumn, sortDirection]);



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

  return (
    <div className="flex-1 overflow-auto bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('title')}
              >
                Задача
                <SortIcon column="title" />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('status')}
              >
                Статус
                <SortIcon column="status" />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('priority')}
              >
                Приоритет
                <SortIcon column="priority" />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('dueDate')}
              >
                Дедлайн
                <SortIcon column="dueDate" />
              </button>
            </TableHead>
            <TableHead>Исполнитель</TableHead>
            <TableHead>Теги</TableHead>
            <TableHead>
              <button
                className="flex items-center hover:text-purple-600"
                onClick={() => handleSort('updatedAt')}
              >
                Обновлено
                <SortIcon column="updatedAt" />
              </button>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedTasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                Задачи не найдены
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedTasks.map((task) => {
              const overdue = isOverdue(task.deadline);
              const assignee = teamMembers?.find((m) => m.id === task.assigneeId);
              
              return (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onTaskClick(task.id)}
                >
                  <TableCell>
                    <div className="max-w-md flex items-center gap-2">
                      <p className={`truncate ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                        {task.title}
                      </p>
                      {task.attachments && task.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{task.attachments.length}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[task.status] || 'bg-purple-100 text-purple-700'}>
                      {statusLabels[task.status] || (task.status.startsWith('custom_') ? 'Загрузка...' : task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority === 'urgent' && (
                        <Flame className="w-3 h-3 mr-1 fill-current" />
                      )}
                      {priorityLabels[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.deadline ? (
                      <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {format(new Date(task.deadline), 'dd MMM yyyy', { locale: ru })}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignee && (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {assignee.avatarUrl && (
                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                          )}
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                            {getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-gray-700">{assignee.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap max-w-xs">
                      {task.tags && task.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {task.tags && task.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{task.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.updatedAt ? (
                      <span className="text-sm text-gray-500">
                        {format(new Date(task.updatedAt), 'dd MMM HH:mm', { locale: ru })}
                      </span>
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
                        {canDeleteTask(task) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(task.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
