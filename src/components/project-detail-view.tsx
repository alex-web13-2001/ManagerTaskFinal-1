import React from 'react';
import { LayoutGrid, Table as TableIcon, Info, ArrowLeft, Loader2, Users, Plus, Search, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectKanbanBoard } from './project-kanban-board';
import { KanbanBoardSkeleton } from './kanban-skeleton';
import { ProjectTaskTable } from './project-task-table';
import { TaskModal } from './task-modal';
import { ProjectAboutModal } from './project-about-modal';
import { ProjectMembersModal } from './project-members-modal';
import { ProjectModal } from './project-modal';
import { useApp } from '../contexts/app-context';
import { useWebSocketContext } from '../contexts/websocket-context';
import type { Filters } from './filters-panel';

type ProjectDetailViewProps = {
  projectId: string;
  onBack?: () => void;
  onCalendarView?: (projectId: string) => void;
};

export function ProjectDetailView({ projectId, onBack, onCalendarView }: ProjectDetailViewProps) {
  const { 
    projects, 
    tasks, 
    isLoading,
    isInitialLoad,
    currentUser,
    teamMembers,
    categories,
    customColumns,
    getUserRoleInProject,
    canEditProject,
    canDeleteProject,
    canCreateTask,
  } = useApp();
  const { joinProject, leaveProject, isConnected } = useWebSocketContext();
  const project = projects.find((p) => p.id === projectId);
  
  // Auto-join project room when viewing the project
  React.useEffect(() => {
    if (isConnected && projectId) {
      joinProject(projectId);
      console.log(`📥 Joined project room: ${projectId}`);
      
      return () => {
        leaveProject(projectId);
        console.log(`📤 Left project room: ${projectId}`);
      };
    }
  }, [isConnected, projectId, joinProject, leaveProject]);
  
  // Debug logging
  React.useEffect(() => {
    console.log('🔍 ProjectDetailView:', {
      projectId,
      projectName: project?.name,
      totalTasks: tasks.length,
      tasksForThisProject: tasks.filter(t => t.projectId === projectId).length,
    });
  }, [projectId, project, tasks]);
  
  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>('kanban');
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = React.useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = React.useState(false);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Определяем роль текущего пользователя в проекте
  const currentUserRole = getUserRoleInProject(projectId);
  
  // Получаем участников проекта для фильтра
  const projectMembers = React.useMemo(() => {
    const members: Array<{ id: string; name: string; email?: string }> = [];
    const seenIds = new Set<string>();
    
    // Добавляем участников проекта
    if (project?.members) {
      project.members.forEach((member: any) => {
        const memberId = member.id || member.userId;
        if (memberId && !seenIds.has(memberId)) {
          seenIds.add(memberId);
          members.push({
            id: memberId,
            name: member.name || member.email || 'Без имени',
            email: member.email,
          });
        }
      });
    }
    
    // Добавляем участников команды
    if (teamMembers) {
      teamMembers.forEach((member) => {
        if (!seenIds.has(member.id)) {
          seenIds.add(member.id);
          members.push({
            id: member.id,
            name: member.name,
            email: member.email,
          });
        }
      });
    }
    
    return members;
  }, [project, teamMembers]);
  
  // FIX Problem #1: Get categories from project.availableCategories
  const projectCategories = React.useMemo(() => {
    if (!project?.availableCategories || !Array.isArray(project.availableCategories)) {
      return [];
    }
    
    // Map category IDs to full category objects
    return project.availableCategories
      .map(catId => categories.find(c => c.id === catId))
      .filter((cat): cat is { id: string; name: string; color?: string } => cat !== undefined);
  }, [project, categories]);
  
  // Фильтры
  const [filters, setFilters] = React.useState<Filters>({
    projects: [projectId],
    categories: [],
    statuses: [],
    priorities: [],
    assignees: [],
    tags: [],
    deadline: 'all',
  });

  // Статичные списки
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
    { id: 'urgent', name: '🔥 Срочный' },
  ];

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const toggleArrayFilter = (key: keyof Filters, value: string) => {
    const currentValues = filters[key] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    setFilters({ ...filters, [key]: newValues });
  };

  const handleClearFilters = () => {
    setFilters({
      projects: [projectId],
      categories: [],
      statuses: [],
      priorities: [],
      assignees: [],
      tags: [],
      deadline: 'all',
    });
    setSearchQuery('');
  };

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assignees.length > 0 ||
    filters.deadline !== 'all' ||
    searchQuery !== '';

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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-gray-900 mb-2">Проект не найден</h2>
          <p className="text-gray-600 mb-4">Проект с таким ID не существует</p>
          {onBack && (
            <Button onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Верхняя панель проекта */}
      <div className="border-b bg-white px-4 md:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getColorClass(project.color)}`} />
              <h1 className="text-gray-900">{project.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCalendarView?.(projectId)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Календарь
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAboutModalOpen(true)}
            >
              <Info className="w-4 h-4 mr-2" />
              О проекте
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMembersModalOpen(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              Участники
            </Button>
          </div>
        </div>

        {/* Поиск и переключатель вида */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск по названию задачи..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

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
                <TableIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Таблица</span>
              </Button>
            </div>
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
                {projectCategories.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">Нет категорий</div>
                ) : (
                  projectCategories.map((category) => (
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
                {projectMembers.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">Нет участников</div>
                ) : (
                  projectMembers.map((member) => (
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
                        {/* FIX Problem #2: Use email as fallback for members without name */}
                        {member.name || member.email || 'Без имени'}
                      </label>
                    </div>
                  ))
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

          {/* Кнопка сброса фильтров */}
          {hasActiveFilters && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 text-purple-600"
              >
                Сбросить все
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Основная область */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Show loading skeleton during initial load or when data is being fetched */}
        {(isInitialLoad || isLoading) && viewMode === 'kanban' ? (
          <KanbanBoardSkeleton columnCount={customColumns.length > 0 ? 4 + customColumns.length : 4} />
        ) : viewMode === 'kanban' ? (
          <ProjectKanbanBoard
            projectId={projectId}
            searchQuery={searchQuery}
            filters={filters}
            onTaskClick={handleTaskClick}
          />
        ) : (
          <ProjectTaskTable
            projectId={projectId}
            searchQuery={searchQuery}
            filters={filters}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* Модальные окна */}
      {selectedTaskId && (
        <TaskModal
          open={!!selectedTaskId}
          onOpenChange={(open) => !open && setSelectedTaskId(null)}
          mode="view"
          taskId={selectedTaskId}
        />
      )}

      <TaskModal
        open={isCreateTaskModalOpen}
        onOpenChange={setIsCreateTaskModalOpen}
        mode="create"
        initialProject={projectId}
      />

      <ProjectAboutModal
        open={isAboutModalOpen}
        onOpenChange={setIsAboutModalOpen}
        projectId={projectId}
        currentUserRole={currentUserRole}
        onManageMembers={() => {
          setIsAboutModalOpen(false);
          setIsMembersModalOpen(true);
        }}
        onEdit={() => {
          setIsAboutModalOpen(false);
          setIsEditProjectModalOpen(true);
        }}
      />

      <ProjectMembersModal
        open={isMembersModalOpen}
        onOpenChange={setIsMembersModalOpen}
        projectId={projectId}
        projectName={project.name}
        projectColor={project.color}
        currentUserRole={currentUserRole}
      />

      <ProjectModal
        open={isEditProjectModalOpen}
        onOpenChange={setIsEditProjectModalOpen}
        mode="edit"
        projectId={projectId}
      />
    </div>
  );
}
