import React from 'react';
import { 
  Plus, 
  Edit, 
  ArrowRight, 
  User, 
  Flame, 
  Calendar, 
  MessageSquare, 
  Folder, 
  Tag 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface TaskHistoryEntry {
  id: string;
  action: string;
  field?: string | null;
  oldValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
  metadata?: {
    commentId?: string;
    text?: string;
  } | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

interface TaskHistoryTimelineProps {
  history: TaskHistoryEntry[];
  projects?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string }>;
}

// Helper to get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Get icon for action type
function getIconForAction(action: string) {
  switch (action) {
    case 'CREATED':
      return <Plus className="w-4 h-4" />;
    case 'STATUS_CHANGED':
      return <ArrowRight className="w-4 h-4" />;
    case 'ASSIGNED':
    case 'UNASSIGNED':
      return <User className="w-4 h-4" />;
    case 'PRIORITY_CHANGED':
      return <Flame className="w-4 h-4" />;
    case 'DEADLINE_SET':
    case 'DEADLINE_CHANGED':
    case 'DEADLINE_REMOVED':
      return <Calendar className="w-4 h-4" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="w-4 h-4" />;
    case 'PROJECT_CHANGED':
      return <Folder className="w-4 h-4" />;
    case 'CATEGORY_CHANGED':
      return <Tag className="w-4 h-4" />;
    default:
      return <Edit className="w-4 h-4" />;
  }
}

// Get color for action type
function getColorForAction(action: string) {
  switch (action) {
    case 'CREATED':
      return 'border-green-500 bg-green-50';
    case 'STATUS_CHANGED':
      return 'border-blue-500 bg-blue-50';
    case 'ASSIGNED':
      return 'border-yellow-500 bg-yellow-50';
    case 'COMMENT_ADDED':
      return 'border-purple-500 bg-purple-50';
    default:
      return 'border-gray-300 bg-gray-50';
  }
}

// Translate status values
function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    todo: 'К выполнению',
    in_progress: 'В процессе',
    done: 'Выполнено',
  };
  return statusMap[status] || status;
}

// Translate priority values
function translatePriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
  };
  return priorityMap[priority] || priority;
}

// Format history message
function formatHistoryMessage(
  entry: TaskHistoryEntry,
  projects?: Array<{ id: string; name: string }>,
  categories?: Array<{ id: string; name: string }>,
  users?: Array<{ id: string; name: string }>
): { message: string; details?: string } {
  switch (entry.action) {
    case 'CREATED':
      return { message: 'создал задачу' };

    case 'STATUS_CHANGED': {
      const oldStatus = translateStatus(entry.oldValue);
      const newStatus = translateStatus(entry.newValue);
      return {
        message: 'изменил статус',
        details: `${oldStatus} → ${newStatus}`,
      };
    }

    case 'ASSIGNED': {
      const userName = users?.find(u => u.id === entry.newValue)?.name || 'Пользователь';
      return {
        message: 'назначил исполнителя',
        details: userName,
      };
    }

    case 'UNASSIGNED': {
      const userName = users?.find(u => u.id === entry.oldValue)?.name || 'Пользователь';
      return {
        message: 'снял исполнителя',
        details: userName,
      };
    }

    case 'PRIORITY_CHANGED': {
      const oldPriority = translatePriority(entry.oldValue);
      const newPriority = translatePriority(entry.newValue);
      return {
        message: 'изменил приоритет',
        details: `${oldPriority} → ${newPriority}`,
      };
    }

    case 'DEADLINE_SET': {
      const date = format(new Date(entry.newValue), 'd MMMM yyyy', { locale: ru });
      return {
        message: 'установил дедлайн',
        details: date,
      };
    }

    case 'DEADLINE_CHANGED': {
      const oldDate = format(new Date(entry.oldValue), 'd MMM', { locale: ru });
      const newDate = format(new Date(entry.newValue), 'd MMM', { locale: ru });
      return {
        message: 'изменил дедлайн',
        details: `${oldDate} → ${newDate}`,
      };
    }

    case 'DEADLINE_REMOVED':
      return { message: 'удалил дедлайн' };

    case 'COMMENT_ADDED': {
      const text = entry.metadata?.text || '';
      return {
        message: 'добавил комментарий',
        details: text.length > 50 ? text.substring(0, 50) + '...' : text,
      };
    }

    case 'PROJECT_CHANGED': {
      const oldProject = projects?.find(p => p.id === entry.oldValue)?.name || 'Личные задачи';
      const newProject = projects?.find(p => p.id === entry.newValue)?.name || 'Личные задачи';
      return {
        message: 'переместил в другой проект',
        details: `${oldProject} → ${newProject}`,
      };
    }

    case 'CATEGORY_CHANGED': {
      const oldCategory = categories?.find(c => c.id === entry.oldValue)?.name || 'Без категории';
      const newCategory = categories?.find(c => c.id === entry.newValue)?.name || 'Без категории';
      return {
        message: 'изменил категорию',
        details: `${oldCategory} → ${newCategory}`,
      };
    }

    case 'UPDATED':
      if (entry.field === 'title') {
        return {
          message: 'изменил название',
          details: entry.newValue,
        };
      }
      if (entry.field === 'description') {
        return { message: 'изменил описание' };
      }
      return { message: 'обновил задачу' };

    default:
      return { message: 'обновил задачу' };
  }
}

export function TaskHistoryTimeline({ 
  history, 
  projects, 
  categories, 
  users 
}: TaskHistoryTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>История изменений пока пуста</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => {
        const { message, details } = formatHistoryMessage(entry, projects, categories, users);
        const isLast = index === history.length - 1;

        return (
          <div key={entry.id} className="relative flex gap-3">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
            )}

            {/* Icon */}
            <div
              className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${getColorForAction(
                entry.action
              )}`}
            >
              {getIconForAction(entry.action)}
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="flex items-start gap-2">
                <Avatar className="w-6 h-6">
                  {entry.user.avatarUrl && <AvatarImage src={entry.user.avatarUrl} />}
                  <AvatarFallback className="text-xs">
                    {getInitials(entry.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{entry.user.name}</span>
                    {' '}
                    <span className="text-gray-600">{message}</span>
                  </p>
                  {details && (
                    <p className="text-sm text-gray-700 mt-1 font-medium">{details}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(entry.createdAt), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
