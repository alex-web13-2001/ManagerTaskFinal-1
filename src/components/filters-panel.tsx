import React from 'react';
import { Filter, X, User, Tag } from 'lucide-react';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useAuth } from '../contexts/auth-context';
import { useProjects } from '../contexts/projects-context';
import { useTasks } from '../contexts/tasks-context';
import { calculateAvailableFilterOptions, getAllUniqueTags } from '../utils/filter-helpers';

export type Filters = {
  projects: string[];
  categories: string[];
  statuses: string[];
  priorities: string[];
  assignees: string[];
  tags: string[];
  deadline: 'all' | 'overdue' | 'today' | '3days' | 'week';
  deadlineFrom?: string;
  deadlineTo?: string;
  onlyNew?: boolean;
};

type FiltersPanelProps = {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
};

const statusesList = [
  { id: 'todo', name: 'К выполнению' },
  { id: 'in_progress', name: 'В работе' },
  { id: 'review', name: 'На проверке' },
  { id: 'done', name: 'Готово' },
];

const prioritiesList = [
  { id: 'low', name: 'Низкий' },
  { id: 'medium', name: 'Средний' },
  { id: 'high', name: 'Высокий' },
  { id: 'urgent', name: 'Срочный' },
];

export function FiltersPanel({ filters, onFiltersChange, onClearFilters }: FiltersPanelProps) {
  const { categories } = useAuth();
  const { projects, teamMembers } = useProjects();
  const { tasks } = useTasks();
  const [newTag, setNewTag] = React.useState('');

  // Calculate available filter options based on current filters (cascading filters)
  const availableFilterCounts = React.useMemo(() => {
    return calculateAvailableFilterOptions(tasks, filters);
  }, [tasks, filters]);

  // Get all unique tags from tasks
  const allTags = React.useMemo(() => getAllUniqueTags(tasks), [tasks]);

  const toggleArrayFilter = (key: keyof Filters, value: string) => {
    const currentValues = filters[key] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    onFiltersChange({ ...filters, [key]: newValues });
  };

  const addTag = () => {
    if (newTag.trim() && !filters.tags.includes(newTag.trim())) {
      onFiltersChange({ ...filters, tags: [...filters.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    onFiltersChange({ ...filters, tags: filters.tags.filter((t) => t !== tag) });
  };

  const hasActiveFilters =
    filters.projects.length > 0 ||
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assignees.length > 0 ||
    filters.tags.length > 0 ||
    filters.deadline !== 'all' ||
    filters.onlyNew === true;

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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Filter className="w-4 h-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Фильтры</SheetTitle>
          <SheetDescription>
            Настройте фильтры для отображения нужных задач
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Проект</Label>
              {filters.projects.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, projects: [] })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {/* Добавляем опцию "Личные задачи" */}
              {(() => {
                const count = availableFilterCounts.projects.get('personal') || 0;
                const isDisabled = count === 0;
                return (
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      id="filter-project-personal"
                      checked={filters.projects.includes('personal')}
                      onCheckedChange={() => toggleArrayFilter('projects', 'personal')}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                    />
                    <label
                      htmlFor="filter-project-personal"
                      className={`text-sm flex items-center gap-2 cursor-pointer flex-1 justify-between ${
                        isDisabled ? 'text-gray-400' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-3 h-3 text-gray-500" />
                        Личные задачи
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </label>
                  </div>
                );
              })()}
              {projects.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">Нет проектов</div>
              ) : (
                projects.map((project) => {
                  const count = availableFilterCounts.projects.get(project.id) || 0;
                  const isDisabled = count === 0;
                  return (
                    <div key={project.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-project-${project.id}`}
                        checked={filters.projects.includes(project.id)}
                        onCheckedChange={() => toggleArrayFilter('projects', project.id)}
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                      />
                      <label
                        htmlFor={`filter-project-${project.id}`}
                        className={`text-sm flex items-center gap-2 cursor-pointer flex-1 justify-between ${
                          isDisabled ? 'text-gray-400' : ''
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <div className={`w-3 h-3 ${getColorClass(project.color)} rounded-sm`} />
                          {project.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {count}
                        </Badge>
                      </label>
                    </div>
                  );
                })
              )}
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Категория</Label>
              {filters.categories.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, categories: [] })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {categories.map((category) => {
                const count = availableFilterCounts.categories.get(category.id) || 0;
                const isDisabled = count === 0;
                return (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-category-${category.id}`}
                      checked={filters.categories.includes(category.id)}
                      onCheckedChange={() => toggleArrayFilter('categories', category.id)}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                    />
                    <label
                      htmlFor={`filter-category-${category.id}`}
                      className={`text-sm flex items-center gap-2 cursor-pointer flex-1 justify-between ${
                        isDisabled ? 'text-gray-400' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${category.color} rounded-sm`} />
                        {category.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Статус</Label>
              {filters.statuses.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, statuses: [] })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {statusesList.map((status) => {
                const count = availableFilterCounts.statuses.get(status.id) || 0;
                const isDisabled = count === 0;
                return (
                  <div key={status.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-status-${status.id}`}
                      checked={filters.statuses.includes(status.id)}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                      onCheckedChange={() => toggleArrayFilter('statuses', status.id)}
                    />
                    <label
                      htmlFor={`filter-status-${status.id}`}
                      className={`text-sm cursor-pointer flex-1 flex items-center justify-between ${
                        isDisabled ? 'text-gray-400' : ''
                      }`}
                    >
                      <span>{status.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Приоритет</Label>
              {filters.priorities.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, priorities: [] })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {prioritiesList.map((priority) => {
                const count = availableFilterCounts.priorities.get(priority.id) || 0;
                const isDisabled = count === 0;
                return (
                  <div key={priority.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-priority-${priority.id}`}
                      checked={filters.priorities.includes(priority.id)}
                      onCheckedChange={() => toggleArrayFilter('priorities', priority.id)}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                    />
                    <label
                      htmlFor={`filter-priority-${priority.id}`}
                      className={`text-sm cursor-pointer flex-1 flex items-center justify-between ${
                        isDisabled ? 'text-gray-400' : ''
                      }`}
                    >
                      <span>{priority.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Исполнитель</Label>
              {filters.assignees.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, assignees: [] })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {teamMembers.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">Нет участников</div>
              ) : (
                teamMembers.map((member) => {
                  const count = availableFilterCounts.assignees.get(member.id) || 0;
                  const isDisabled = count === 0;
                  return (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-assignee-${member.id}`}
                        checked={filters.assignees.includes(member.id)}
                        onCheckedChange={() => toggleArrayFilter('assignees', member.id)}
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                      />
                      <label
                        htmlFor={`filter-assignee-${member.id}`}
                        className={`text-sm cursor-pointer flex-1 flex items-center justify-between ${
                          isDisabled ? 'text-gray-400' : ''
                        }`}
                      >
                        <span>{member.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {count}
                        </Badge>
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Дедлайн</Label>
              {filters.deadline !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, deadline: 'all' })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <Select 
              value={filters.deadline} 
              onValueChange={(value: any) => onFiltersChange({ ...filters, deadline: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все задачи</SelectItem>
                <SelectItem value="overdue">Просрочено</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="3days">3 дня</SelectItem>
                <SelectItem value="week">На этой неделе</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Теги</Label>
              {filters.tags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, tags: [] })}
                  className="h-auto p-0 text-xs text-purple-600"
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {allTags.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">Нет тегов</div>
              ) : (
                allTags.map((tag) => {
                  const count = availableFilterCounts.tags.get(tag) || 0;
                  const isDisabled = count === 0;
                  return (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-tag-${tag}`}
                        checked={filters.tags.includes(tag)}
                        onCheckedChange={() => toggleArrayFilter('tags', tag)}
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                      />
                      <label
                        htmlFor={`filter-tag-${tag}`}
                        className={`text-sm cursor-pointer flex-1 flex items-center justify-between ${
                          isDisabled ? 'text-gray-400' : ''
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {count}
                        </Badge>
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Новые задачи</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-only-new"
                checked={filters.onlyNew || false}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, onlyNew: checked === true })
                }
              />
              <label
                htmlFor="filter-only-new"
                className="text-sm cursor-pointer flex-1"
              >
                Показывать только новые задачи
              </label>
            </div>
          </div>

          <Separator />

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClearFilters} className="flex-1">
              Сбросить все
            </Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700">
              Применить
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
