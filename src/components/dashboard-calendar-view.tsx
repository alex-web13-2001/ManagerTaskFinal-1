import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Filter,
  X,
  Tag,
  Briefcase,
  User,
  AlertCircle,
  Repeat,
  Flame,
  ChevronUp,
} from 'lucide-react';
import { type Task } from '../contexts/app-context';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';
import { useProjects } from '../contexts/projects-context';
import { format, addDays, startOfDay, endOfDay, isSameDay, isWithinInterval, differenceInDays, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TaskModal } from './task-modal';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

type DashboardCalendarViewProps = {
  onBack?: () => void;
};

const STATUS_COLORS = {
  todo: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  needs_clarification: 'bg-orange-500',
  review: 'bg-yellow-500',
  done: 'bg-green-500',
};

export function DashboardCalendarView({
  onBack,
}: DashboardCalendarViewProps) {
  const { categories } = useAuth();
  const { tasks } = useTasks();
  const { projects, teamMembers } = useProjects();
  const [dateRange, setDateRange] = React.useState<'1week' | '2weeks' | '1month' | '3months'>('2weeks');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [selectedProjects, setSelectedProjects] = React.useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Get date range based on filter
  const { startDate, endDate, totalDays } = React.useMemo(() => {
    const today = new Date();
    let daysBack = 14;
    let daysForward = 14;
    
    switch (dateRange) {
      case '1week':
        daysBack = 7;
        daysForward = 7;
        break;
      case '2weeks':
        daysBack = 14;
        daysForward = 14;
        break;
      case '1month':
        daysBack = 30;
        daysForward = 30;
        break;
      case '3months':
        daysBack = 90;
        daysForward = 90;
        break;
    }
    
    const start = startOfDay(addDays(today, -daysBack));
    const end = endOfDay(addDays(today, daysForward));
    const total = differenceInDays(end, start) + 1;
    
    return { startDate: start, endDate: end, totalDays: total };
  }, [dateRange]);

  // Generate array of dates for the calendar
  const dates = React.useMemo(() => {
    const dateArray: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      dateArray.push(addDays(startDate, i));
    }
    return dateArray;
  }, [startDate, totalDays]);

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      // Project filter - separate personal and project tasks
      if (selectedProjects.length > 0) {
        if (task.projectId) {
          // Project task - must be in selected projects
          if (!selectedProjects.includes(task.projectId)) {
            return false;
          }
        } else {
          // Personal task - only show if 'personal' is selected
          if (!selectedProjects.includes('personal')) {
            return false;
          }
        }
      }
      
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      
      // Assignee filter
      if (assigneeFilter !== 'all' && task.assigneeId !== assigneeFilter) return false;
      
      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      
      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'no-category') {
          if (task.categoryId) return false;
        } else {
          if (task.categoryId !== categoryFilter) return false;
        }
      }
      
      return true;
    });
  }, [tasks, selectedProjects, statusFilter, assigneeFilter, priorityFilter, categoryFilter]);

  // Group tasks by row to avoid overlapping
  const taskRows = React.useMemo(() => {
    const rows: Task[][] = [];
    const sortedTasks = [...filteredTasks].sort((a, b) => {
      const aStart = a.createdAt ? new Date(a.createdAt) : new Date();
      const bStart = b.createdAt ? new Date(b.createdAt) : new Date();
      return aStart.getTime() - bStart.getTime();
    });

    sortedTasks.forEach(task => {
      // Find a row where this task doesn't overlap
      let placed = false;
      for (const row of rows) {
        const hasOverlap = row.some(existingTask => {
          const taskStart = task.createdAt ? new Date(task.createdAt) : new Date();
          const taskEnd = task.deadline ? new Date(task.deadline) : taskStart;
          const existingStart = existingTask.createdAt ? new Date(existingTask.createdAt) : new Date();
          const existingEnd = existingTask.deadline ? new Date(existingTask.deadline) : existingStart;
          
          return !(taskEnd < existingStart || taskStart > existingEnd);
        });
        
        if (!hasOverlap) {
          row.push(task);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        rows.push([task]);
      }
    });

    return rows;
  }, [filteredTasks]);

  // Calculate task position and width
  const getTaskStyle = (task: Task) => {
    const taskStart = task.createdAt ? startOfDay(new Date(task.createdAt)) : startOfDay(new Date());
    // Если нет дедлайна, растягиваем до конца выбранного периода
    const taskEnd = task.deadline ? startOfDay(new Date(task.deadline)) : endDate;
    
    // Calculate offset from start date
    const offsetDays = differenceInDays(taskStart, startDate);
    const durationDays = differenceInDays(taskEnd, taskStart) + 1;
    
    const dayWidth = 60; // pixels per day
    const left = Math.max(0, offsetDays * dayWidth);
    const width = Math.max(dayWidth * 0.8, durationDays * dayWidth);
    
    return { left, width };
  };

  // Check if task is visible in current date range
  const isTaskVisible = (task: Task) => {
    const taskStart = task.createdAt ? new Date(task.createdAt) : new Date();
    // Если нет дедлайна, растягиваем до конца выбранного периода
    const taskEnd = task.deadline ? new Date(task.deadline) : endDate;
    
    return isWithinInterval(taskStart, { start: startDate, end: endDate }) ||
           isWithinInterval(taskEnd, { start: startDate, end: endDate }) ||
           (taskStart < startDate && taskEnd > endDate);
  };

  const getAssigneeName = (assigneeId?: string) => {
    if (!assigneeId) return 'Без исполнителя';
    const member = teamMembers.find(m => m.id === assigneeId);
    return member?.name || 'Неизвестный';
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.name || null;
  };

  const getProjectInfo = (projectId?: string) => {
    if (!projectId) return { name: 'Личная задача', color: 'gray' };
    const project = projects.find(p => p.id === projectId);
    return { name: project?.name || 'Неизвестный проект', color: project?.color || 'gray' };
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  const scrollToToday = () => {
    const today = new Date();
    const daysSinceStart = differenceInDays(today, startDate);
    const dayWidth = 60;
    const scrollLeft = Math.max(0, daysSinceStart * dayWidth - 300); // Center today
    
    const scrollArea = document.querySelector('[data-calendar-scroll]');
    if (scrollArea) {
      scrollArea.scrollLeft = scrollLeft;
    }
  };

  React.useEffect(() => {
    // Scroll to today when opening
    setTimeout(scrollToToday, 100);
  }, [dateRange]);

  const clearFilters = () => {
    setStatusFilter('all');
    setAssigneeFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setSelectedProjects([]);
  };

  const hasActiveFilters = statusFilter !== 'all' || assigneeFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || selectedProjects.length > 0;

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-500',
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      pink: 'bg-pink-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
      indigo: 'bg-indigo-500',
      gray: 'bg-gray-500',
    };
    return colorMap[color || 'purple'] || 'bg-purple-500';
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const selectAllProjects = () => {
    const allProjectIds = projects.map(p => p.id);
    // Also include 'personal' for personal tasks
    const hasPersonalTasks = tasks.some(t => !t.projectId);
    if (hasPersonalTasks) {
      allProjectIds.push('personal');
    }
    setSelectedProjects(allProjectIds);
  };

  const deselectAllProjects = () => {
    setSelectedProjects([]);
  };

  const hasPersonalTasks = tasks.some(t => !t.projectId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b bg-white px-4 md:px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            <h1 className="text-gray-900">Календарь задач</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Фильтры:</span>
          </div>

          {/* Projects Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Briefcase className="w-3 h-3 mr-1" />
                Проекты
                {selectedProjects.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                    {selectedProjects.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Проекты</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllProjects}
                      className="h-6 text-xs"
                    >
                      Все
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllProjects}
                      className="h-6 text-xs"
                    >
                      Сброс
                    </Button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {/* Personal tasks option */}
                  {hasPersonalTasks && (
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        id="project-personal"
                        checked={selectedProjects.includes('personal')}
                        onCheckedChange={() => toggleProject('personal')}
                      />
                      <label
                        htmlFor="project-personal"
                        className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                      >
                        <User className="w-3 h-3 text-gray-500" />
                        Личные задачи
                      </label>
                    </div>
                  )}
                  
                  {/* Project tasks */}
                  {projects.map((project) => (
                    <div key={project.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={selectedProjects.includes(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                      <label
                        htmlFor={`project-${project.id}`}
                        className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                      >
                        <div className={`w-3 h-3 rounded-full ${getColorClass(project.color)}`} />
                        {project.name}
                      </label>
                    </div>
                  ))}
                  {projects.length === 0 && !hasPersonalTasks && (
                    <p className="text-sm text-gray-500">Нет проектов</p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1week">1 неделя</SelectItem>
              <SelectItem value="2weeks">2 недели</SelectItem>
              <SelectItem value="1month">1 месяц</SelectItem>
              <SelectItem value="3months">3 месяца</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="todo">К выполнению</SelectItem>
              <SelectItem value="in_progress">В работе</SelectItem>
              <SelectItem value="needs_clarification">Нужно уточнение</SelectItem>
              <SelectItem value="review">На проверке</SelectItem>
              <SelectItem value="done">Готово</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Исполнитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все исполнители</SelectItem>
              {teamMembers.map(member => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              <SelectItem value="high">Высокий</SelectItem>
              <SelectItem value="medium">Средний</SelectItem>
              <SelectItem value="low">Низкий</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              <SelectItem value="no-category">Без категории</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="w-4 h-4 mr-1" />
              Сбросить
            </Button>
          )}

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={scrollToToday}>
              Сегодня
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div 
          className="flex-1 overflow-x-auto overflow-y-auto"
          data-calendar-scroll
        >
          <div className="min-w-max">
            {/* Header with dates */}
            <div className="sticky top-0 bg-gradient-to-b from-gray-50 to-white z-10 border-b-2 border-gray-200">
              <div className="flex">
                {dates.map((date, index) => {
                  const isToday = isSameDay(date, new Date());
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isMonthStart = date.getDate() === 1;
                  
                  return (
                    <div
                      key={index}
                      className={`flex-shrink-0 w-[60px] p-2 text-center border-r relative ${
                        isToday ? 'bg-purple-100/50' : isWeekend ? 'bg-gray-100/30' : ''
                      }`}
                    >
                      {isToday && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-600" />
                      )}
                      {isMonthStart && (
                        <div className="absolute -left-px top-0 bottom-0 w-0.5 bg-gray-300" />
                      )}
                      <div className={`text-[10px] uppercase tracking-wide mb-0.5 ${
                        isToday ? 'text-purple-700 font-bold' : 'text-gray-500'
                      }`}>
                        {format(date, 'EEE', { locale: ru })}
                      </div>
                      <div className={`text-lg leading-none mb-0.5 ${
                        isToday ? 'text-purple-700 font-bold bg-purple-200 rounded-full w-7 h-7 mx-auto flex items-center justify-center' : 
                        'text-gray-900'
                      }`}>
                        {format(date, 'd', { locale: ru })}
                      </div>
                      <div className={`text-[10px] ${isToday ? 'text-purple-600' : 'text-gray-400'}`}>
                        {isMonthStart ? format(date, 'MMM', { locale: ru }) : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task rows */}
            <div className="relative" style={{ minHeight: `${taskRows.length * 60 + 40}px` }}>
              {/* Background grid */}
              <div className="absolute inset-0 flex">
                {dates.map((date, index) => {
                  const isToday = isSameDay(date, new Date());
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <div
                      key={index}
                      className={`flex-shrink-0 w-[60px] border-r ${
                        isToday ? 'bg-purple-50/50' : isWeekend ? 'bg-gray-50/50' : ''
                      }`}
                    />
                  );
                })}
              </div>

              {/* Tasks */}
              {taskRows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="relative h-[90px] border-b"
                >
                  {row.map(task => {
                    if (!isTaskVisible(task)) return null;
                    
                    const { left, width } = getTaskStyle(task);
                    const categoryName = getCategoryName(task.categoryId);
                    const projectInfo = getProjectInfo(task.projectId);
                    
                    // Проверка на просроченность
                    const isOverdue = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date();
                    const statusColor = isOverdue 
                      ? 'bg-red-600' 
                      : STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || 'bg-gray-400';
                    
                    return (
                      <div
                        key={task.id}
                        className={`absolute top-2 h-[82px] rounded-lg cursor-pointer transition-all overflow-hidden group border-2 ${
                          task.status === 'done' ? 'opacity-60 border-green-200 bg-green-50' : 
                          isOverdue ? 'border-red-300 bg-red-50/80' :
                          task.isRecurring ? 'border-purple-300 bg-purple-50/80' :
                          task.priority === 'urgent' ? 'border-orange-300 bg-orange-50/80' :
                          task.priority === 'high' ? 'border-pink-300 bg-pink-50/80' :
                          'border-blue-200 bg-white'
                        } hover:shadow-lg hover:scale-[1.02] hover:z-10`}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="px-3 py-2.5 h-full flex flex-col gap-1.5">
                          {/* Header: project + priority/status icons */}
                          <div className="flex items-center gap-1 min-h-[14px]">
                            <div className={`w-1.5 h-1.5 rounded-full ${getColorClass(projectInfo.color)} flex-shrink-0`} />
                            <span className={`text-gray-600 text-[10px] truncate flex-1 ${task.status === 'done' ? 'line-through' : ''}`}>
                              {projectInfo.name}
                            </span>
                            {/* Иконки статусов и приоритета */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {task.isRecurring && (
                                <Repeat className="w-3.5 h-3.5 text-purple-600" />
                              )}
                              {task.priority === 'urgent' && (
                                <Flame className="w-3.5 h-3.5 text-orange-600 fill-orange-600" />
                              )}
                              {task.priority === 'high' && (
                                <ChevronUp className="w-3.5 h-3.5 text-pink-600 stroke-[3]" />
                              )}
                              {isOverdue && (
                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                              )}
                            </div>
                          </div>
                          
                          {/* Task title - крупнее и заметнее */}
                          <div className={`text-sm text-gray-900 font-extrabold leading-tight truncate ${task.status === 'done' ? 'line-through' : ''}`}>
                            {task.title}
                          </div>
                          
                          {/* Category badge */}
                          {categoryName && (
                            <div className="flex items-center gap-1 mt-auto">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200">
                                <Tag className="w-2 h-2 mr-0.5" />
                                {categoryName}
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        {/* Tooltip on hover */}
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-20 shadow-xl border border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${getColorClass(projectInfo.color)} flex-shrink-0`} />
                            <span className="text-gray-300 font-medium">{projectInfo.name}</span>
                          </div>
                          <div className="font-bold text-white mb-1.5">{task.title}</div>
                          <div className="text-gray-400 flex items-center gap-1 mb-1">
                            <CalendarIcon className="w-3 h-3" />
                            {task.createdAt && format(new Date(task.createdAt), 'dd.MM.yyyy', { locale: ru })}
                            {' → '}
                            {task.deadline && format(new Date(task.deadline), 'dd.MM.yyyy', { locale: ru })}
                          </div>
                          {task.isRecurring && (
                            <div className="text-purple-300 flex items-center gap-1 mb-1">
                              <Repeat className="w-3 h-3" />
                              Повторяется каждые {task.recurringIntervalDays} {task.recurringIntervalDays === 1 ? 'день' : 'дней'}
                            </div>
                          )}
                          {categoryName && (
                            <div className="text-purple-300 flex items-center gap-1 mb-1">
                              <Tag className="w-3 h-3" />
                              {categoryName}
                            </div>
                          )}
                          {task.assigneeId && (
                            <div className="text-gray-400 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {getAssigneeName(task.assigneeId)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Empty state */}
              {taskRows.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center py-12">
                    <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Нет задач для отображения</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {hasActiveFilters ? 'Попробуйте изменить фильтры' : 'Создайте задачи с дедлайнами'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with legend */}
      <div className="border-t px-4 md:px-6 py-3 flex items-center gap-4 text-xs bg-white">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-500 rounded" />
            <span className="text-gray-600">К выполнению</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-gray-600">В работе</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded" />
            <span className="text-gray-600">Нужно уточнение</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <span className="text-gray-600">На проверке</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-gray-600">Готово</span>
          </div>
        </div>
        <div className="text-gray-500">
          Всего задач: {filteredTasks.length}
        </div>
      </div>

      {/* Task Modal */}
      {selectedTaskId && (
        <TaskModal
          open={!!selectedTaskId}
          onOpenChange={(open) => !open && setSelectedTaskId(null)}
          mode="view"
          taskId={selectedTaskId}
        />
      )}
    </div>
  );
}
