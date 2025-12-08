import React from 'react';
import { LayoutGrid, List, X, Search, User, Users, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { KanbanBoard } from './kanban-board';
import { KanbanBoardSkeleton } from './kanban-skeleton';
import { TaskTable } from './task-table';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';
import { useProjects } from '../contexts/projects-context';

type Filters = {
  projects: string[];
  categories: string[];
  statuses: string[];
  priorities: string[];
  assignees: string[];
  tags: string[];
  deadline: 'all' | 'overdue' | 'today' | '3days' | 'week';
  onlyNew?: boolean;
};

// Статичные списки статусов и приоритетов
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

type DashboardViewProps = {
  onCalendarView?: () => void;
  onTaskClick?: (taskId: string) => void;
};

export function DashboardView({ onCalendarView, onTaskClick }: DashboardViewProps = {}) {
  const { currentUser, categories, customColumns } = useAuth();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { projects, teamMembers, isLoading: projectsLoading } = useProjects();
  // Combine loading states (isInitialLoad not needed for this view)
  const isLoading = tasksLoading || projectsLoading;
  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showMyTasks, setShowMyTasks] = React.useState(false);
  const [showCustomColumns, setShowCustomColumns] = React.useState(() => {
    const stored = localStorage.getItem('dashboard-show-custom-columns');
    return stored !== null ? stored === 'true' : true; // По умолчанию показываем
  });
  const [filters, setFilters] = React.useState<Filters>({
    projects: [],
    categories: [],
    statuses: [],
    priorities: [],
    assignees: [],
    tags: [],
    deadline: 'all',
    onlyNew: false,
  });

  // FIX Problem #1: Collect all categories from projects where user is a member + personal categories
  const availableCategories = React.useMemo(() => {
    const categoryMap = new Map<string, { id: string; name: string; color?: string }>();
    
    // Add personal categories (from global categories list)
    categories.forEach(cat => {
      categoryMap.set(cat.id, cat);
    });
    
    // Add categories from all projects where user is a member
    // Use categoriesDetails field which contains full category objects from the project owner
    projects.forEach(project => {
      if (project.categoriesDetails && Array.isArray(project.categoriesDetails)) {
        project.categoriesDetails.forEach(category => {
          if (!categoryMap.has(category.id)) {
            categoryMap.set(category.id, category);
          }
        });
      }
    });
    
    return Array.from(categoryMap.values());
  }, [projects, categories]);

  // Save showCustomColumns to localStorage
  React.useEffect(() => {
    localStorage.setItem('dashboard-show-custom-columns', String(showCustomColumns));
  }, [showCustomColumns]);

  const handleClearFilters = () => {
    setFilters({
      projects: [],
      categories: [],
      statuses: [],
      priorities: [],
      assignees: [],
      tags: [],
      deadline: 'all',
      onlyNew: false,
    });
    setShowMyTasks(false);
  };

  const handleTaskClick = (taskId: string) => {
    onTaskClick?.(taskId);
  };

  const toggleArrayFilter = (key: keyof Filters, value: string) => {
    const currentValues = filters[key] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    setFilters({ ...filters, [key]: newValues });
  };

  const hasActiveFilters =
    showMyTasks ||
    filters.projects.length > 0 ||
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assignees.length > 0 ||
    filters.tags.length > 0 ||
    filters.deadline !== 'all';

  // Объединяем фильтр "Назначенные на меня" с остальными фильтрами
  const effectiveFilters = React.useMemo(() => {
    if (!showMyTasks || !currentUser) return filters;
    
    return {
      ...filters,
      assignees: currentUser.id ? [currentUser.id] : filters.assignees,
    };
  }, [filters, showMyTasks, currentUser]);

  // Получаем цвет проекта для отображения
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-gray-900 mb-1">Дашборд</h1>
            <p className="text-gray-600">Обзор всех задач из проектов и личных задач</p>
          </div>
        </div>

        {/* Поиск, переключатель "Назначенные на меня" и переключатель вида */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск по названию или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Переключатель Все задачи/Назначенные на меня */}
          <motion.div 
            className="flex items-center gap-2 shrink-0"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative flex border-2 border-purple-200 rounded-lg bg-white overflow-hidden shadow-sm">
              <motion.div
                className="absolute inset-y-0 bg-gradient-to-r from-purple-600 to-purple-500 rounded-md shadow-md"
                initial={false}
                animate={{
                  left: showMyTasks ? '50%' : '0%',
                  width: '50%',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMyTasks(false)}
                className={`relative z-10 px-3 sm:px-4 transition-colors duration-200 ${
                  !showMyTasks ? 'text-white hover:text-white' : 'text-gray-700 hover:text-gray-900 hover:bg-transparent'
                }`}
              >
                <Users className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Все задачи</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMyTasks(true)}
                className={`relative z-10 px-3 sm:px-4 transition-colors duration-200 ${
                  showMyTasks ? 'text-white hover:text-white' : 'text-gray-700 hover:text-gray-900 hover:bg-transparent'
                }`}
              >
                <User className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Назначенные на меня</span>
              </Button>
            </div>
          </motion.div>

          {/* Переключатель вида */}
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-sm text-gray-600 hidden sm:inline">Вид:</Label>
            <div className="flex border rounded-lg bg-white">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className={`${viewMode === 'kanban' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
              >
                <LayoutGrid className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={`${viewMode === 'table' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
              >
                <List className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Таблица</span>
              </Button>
            </div>
            {onCalendarView && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCalendarView}
              >
                <Calendar className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Календарь</span>
              </Button>
            )}
          </div>
        </div>

        {/* Фильтры */}
        <motion.div 
          className="flex items-center gap-2 flex-wrap"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Label className="text-sm text-gray-600">Фильтры:</Label>

          {/* Проект */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Проект
                <AnimatePresence>
                  {filters.projects.length > 0 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                        {filters.projects.length}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Проект</Label>
                  {filters.projects.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ ...filters, projects: [] })}
                      className="h-auto p-0 text-xs text-purple-600"
                    >
                      Очистить
                    </Button>
                  )}
                </div>
                {/* Добавляем опцию "Личные задачи" */}
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id="project-personal"
                    checked={filters.projects.includes('personal')}
                    onCheckedChange={() => toggleArrayFilter('projects', 'personal')}
                  />
                  <label
                    htmlFor="project-personal"
                    className="text-sm flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <User className="w-3 h-3 text-gray-500" />
                    Личные задачи
                  </label>
                </div>
                {projects.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">Нет проектов</div>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={filters.projects.includes(project.id)}
                        onCheckedChange={() => toggleArrayFilter('projects', project.id)}
                      />
                      <label
                        htmlFor={`project-${project.id}`}
                        className="text-sm flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <div className={`w-3 h-3 ${getColorClass(project.color)} rounded-sm`} />
                        {project.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Категория */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Категория
                <AnimatePresence>
                  {filters.categories.length > 0 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                        {filters.categories.length}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Категория</Label>
                  {filters.categories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ ...filters, categories: [] })}
                      className="h-auto p-0 text-xs text-purple-600"
                    >
                      Очистить
                    </Button>
                  )}
                </div>
                {availableCategories.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">Нет категорий</div>
                ) : (
                  availableCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={filters.categories.includes(category.id)}
                        onCheckedChange={() => toggleArrayFilter('categories', category.id)}
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {category.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Статус */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Статус
                {filters.statuses.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                    {filters.statuses.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Статус</Label>
                  {filters.statuses.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ ...filters, statuses: [] })}
                      className="h-auto p-0 text-xs text-purple-600"
                    >
                      Очистить
                    </Button>
                  )}
                </div>
                {statusesList.map((status) => (
                  <div key={status.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.id}`}
                      checked={filters.statuses.includes(status.id)}
                      onCheckedChange={() => toggleArrayFilter('statuses', status.id)}
                    />
                    <label
                      htmlFor={`status-${status.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {status.name}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Приоритет */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Приоритет
                {filters.priorities.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                    {filters.priorities.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Приоритет</Label>
                  {filters.priorities.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ ...filters, priorities: [] })}
                      className="h-auto p-0 text-xs text-purple-600"
                    >
                      Очистить
                    </Button>
                  )}
                </div>
                {prioritiesList.map((priority) => (
                  <div key={priority.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`priority-${priority.id}`}
                      checked={filters.priorities.includes(priority.id)}
                      onCheckedChange={() => toggleArrayFilter('priorities', priority.id)}
                    />
                    <label
                      htmlFor={`priority-${priority.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {priority.name}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Исполнитель */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Исполнитель
                {filters.assignees.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                    {filters.assignees.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Исполнитель</Label>
                  {filters.assignees.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ ...filters, assignees: [] })}
                      className="h-auto p-0 text-xs text-purple-600"
                    >
                      Очистить
                    </Button>
                  )}
                </div>
                {/* FIX Problem #2: Add special option for unassigned tasks */}
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id="assignee-unassigned"
                    checked={filters.assignees.includes('unassigned')}
                    onCheckedChange={() => toggleArrayFilter('assignees', 'unassigned')}
                  />
                  <label
                    htmlFor="assignee-unassigned"
                    className="text-sm cursor-pointer flex-1 text-gray-500 italic"
                  >
                    Не назначено
                  </label>
                </div>
                {teamMembers.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">Нет участников</div>
                ) : (
                  // FIX Problem #2: Deduplicate members by ID and use email as fallback
                  (() => {
                    const uniqueMembers = Array.from(
                      new Map(teamMembers.map(m => [m.id, m])).values()
                    );
                    return uniqueMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`assignee-${member.id}`}
                          checked={filters.assignees.includes(member.id)}
                          onCheckedChange={() => toggleArrayFilter('assignees', member.id)}
                        />
                        <label
                          htmlFor={`assignee-${member.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {member.name || member.email || 'Без имени'}
                        </label>
                      </div>
                    ));
                  })()
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Дедлайн */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Дедлайн
                {filters.deadline !== 'all' && (
                  <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                    1
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-3">
                <Label className="text-sm">Фильтр по дедлайну</Label>
                <RadioGroup
                  value={filters.deadline}
                  onValueChange={(value: any) =>
                    setFilters({ ...filters, deadline: value })
                  }
                >
                  {[
                    { value: 'all', label: 'Все задачи' },
                    { value: 'overdue', label: 'Просрочено' },
                    { value: 'today', label: 'Сегодня' },
                    { value: '3days', label: '3 дня' },
                    { value: 'week', label: 'На этой неделе' },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option.value}
                        id={`deadline-${option.value}`}
                      />
                      <Label
                        htmlFor={`deadline-${option.value}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </PopoverContent>
          </Popover>

          {/* Переключатель "Мои статусы" (только для Kanban режима) */}
          {viewMode === 'kanban' && (
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="custom-columns"
                checked={showCustomColumns}
                onCheckedChange={setShowCustomColumns}
              />
              <Label
                htmlFor="custom-columns"
                className="text-sm text-gray-600 cursor-pointer whitespace-nowrap"
              >
                Мои статусы
              </Label>
            </div>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 text-purple-600"
            >
              <X className="w-4 h-4 mr-1" />
              Сбросить все
            </Button>
          )}
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Show loading skeleton during initial load or when data is being fetched */}
        {isLoading && viewMode === 'kanban' ? (
          <KanbanBoardSkeleton columnCount={showCustomColumns && customColumns.length > 0 ? 4 + customColumns.length : 4} />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard 
            searchQuery={searchQuery} 
            filters={effectiveFilters} 
            onTaskClick={handleTaskClick}
            showCustomColumns={showCustomColumns}
            availableCategories={availableCategories}
          />
        ) : (
          <TaskTable searchQuery={searchQuery} filters={effectiveFilters} onTaskClick={handleTaskClick} />
        )}
      </div>
    </div>
  );
}
