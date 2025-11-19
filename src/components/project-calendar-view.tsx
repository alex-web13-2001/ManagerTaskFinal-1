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
  AlertCircle,
  Repeat,
  Flame,
  User,
  ChevronUp,
} from 'lucide-react';
import { type Task } from '../contexts/app-context';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';
import { useProjects } from '../contexts/projects-context';
import { format, addDays, startOfDay, endOfDay, isSameDay, isWithinInterval, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TaskModal } from './task-modal';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

type ProjectCalendarViewProps = {
  projectId: string;
  onBack?: () => void;
};

const STATUS_COLORS = {
  todo: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  review: 'bg-yellow-500',
  done: 'bg-green-500',
};

type CategoryGroup = {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  tasks: Task[];
  rows: Task[][];
};

export function ProjectCalendarView({
  projectId,
  onBack,
}: ProjectCalendarViewProps) {
  const { currentUser, categories } = useAuth();
  const { tasks, canViewAllProjectTasks } = useTasks();
  const { projects, teamMembers } = useProjects();
  const [dateRange, setDateRange] = React.useState<'1week' | '2weeks' | '1month' | '3months'>('2weeks');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  const project = projects.find(p => p.id === projectId);
  
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

  // Helper function for color classes
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
    };
    return colorMap[color || 'purple'] || 'bg-purple-500';
  };

  // Filter project tasks
  const projectTasks = React.useMemo(() => {
    return tasks.filter(task => {
      if (task.projectId !== projectId) return false;
      
      // Role-based access control: Members should only see tasks assigned to them
      if (!canViewAllProjectTasks(projectId)) {
        // Member role - only show tasks assigned to current user
        const currentUserId = currentUser?.id;
        if (!currentUserId || task.assigneeId !== currentUserId) {
          return false;
        }
      }
      
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      
      // Assignee filter
      if (assigneeFilter !== 'all' && task.assigneeId !== assigneeFilter) return false;
      
      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      
      // Category filter
      if (selectedCategories.length > 0) {
        if (task.categoryId) {
          if (!selectedCategories.includes(task.categoryId)) return false;
        } else {
          if (!selectedCategories.includes('no-category')) return false;
        }
      }
      
      return true;
    });
  }, [tasks, projectId, statusFilter, assigneeFilter, priorityFilter, selectedCategories, canViewAllProjectTasks, currentUser]);

  // Group tasks by category
  const categoryGroups = React.useMemo(() => {
    const groups: CategoryGroup[] = [];
    
    // Group tasks by category
    const tasksByCategory = new Map<string | null, Task[]>();
    
    projectTasks.forEach(task => {
      const categoryId = task.categoryId || null;
      if (!tasksByCategory.has(categoryId)) {
        tasksByCategory.set(categoryId, []);
      }
      tasksByCategory.get(categoryId)!.push(task);
    });
    
    // Create category groups
    tasksByCategory.forEach((tasks, categoryId) => {
      let categoryName = 'Без категории';
      let categoryColor = 'bg-gray-400';
      
      if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          categoryName = category.name;
          categoryColor = getColorClass(category.color);
        }
      }
      
      // Group tasks into rows to avoid overlapping
      const rows: Task[][] = [];
      const sortedTasks = [...tasks].sort((a, b) => {
        const aStart = a.createdAt ? new Date(a.createdAt) : new Date();
        const bStart = b.createdAt ? new Date(b.createdAt) : new Date();
        return aStart.getTime() - bStart.getTime();
      });

      sortedTasks.forEach(task => {
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
      
      groups.push({
        categoryId,
        categoryName,
        categoryColor,
        tasks,
        rows,
      });
    });
    
    // Sort groups: categories with tasks first, then "Без категории"
    groups.sort((a, b) => {
      if (a.categoryId === null) return 1;
      if (b.categoryId === null) return -1;
      return a.categoryName.localeCompare(b.categoryName);
    });
    
    return groups;
  }, [projectTasks, categories]);

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
    if (!categoryId) return 'Без категории';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Без категории';
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  // Calculate total rows count for adaptive font sizing
  const totalRowsCount = React.useMemo(() => {
    return categoryGroups.reduce((sum, group) => sum + group.rows.length, 0);
  }, [categoryGroups]);

  // Adaptive font size based on rows count
  const getAdaptiveFontSize = () => {
    if (totalRowsCount <= 3) return 'text-lg';   // Крупный шрифт для малого количества задач
    if (totalRowsCount <= 6) return 'text-base'; // Средний шрифт
    if (totalRowsCount <= 10) return 'text-sm';  // Меньше
    return 'text-[13px]';                         // Самый маленький для большого количества
  };

  const adaptiveFontClass = getAdaptiveFontSize();

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
    setSelectedCategories([]);
  };

  const hasActiveFilters = statusFilter !== 'all' || assigneeFilter !== 'all' || priorityFilter !== 'all' || selectedCategories.length > 0;

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const selectAllCategories = () => {
    const allCategoryIds = categories.map(c => c.id);
    // Also include 'no-category' if there are tasks without category
    const hasTasksWithoutCategory = projectTasks.some(t => !t.categoryId);
    if (hasTasksWithoutCategory) {
      allCategoryIds.push('no-category');
    }
    setSelectedCategories(allCategoryIds);
  };

  const deselectAllCategories = () => {
    setSelectedCategories([]);
  };

  // Get categories used in this project
  const projectCategories = React.useMemo(() => {
    const usedCategoryIds = new Set(projectTasks.map(t => t.categoryId).filter(Boolean));
    return categories.filter(c => usedCategoryIds.has(c.id));
  }, [categories, projectTasks]);

  const hasTasksWithoutCategory = projectTasks.some(t => !t.categoryId);

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
            <h1 className="text-gray-900">Календарь проекта: {project?.name}</h1>
          </div>
          {project?.color && (
            <div className={`w-3 h-3 rounded-full ${getColorClass(project.color)}`} />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Фильтры:</span>
          </div>

          {/* Categories Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Tag className="w-3 h-3 mr-1" />
                Категории
                {selectedCategories.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                    {selectedCategories.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Категории</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllCategories}
                      className="h-6 text-xs"
                    >
                      Все
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllCategories}
                      className="h-6 text-xs"
                    >
                      Сброс
                    </Button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {projectCategories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                      >
                        <div className={`w-3 h-3 rounded-full ${getColorClass(category.color)}`} />
                        {category.name}
                      </label>
                    </div>
                  ))}
                  {hasTasksWithoutCategory && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Checkbox
                        id="category-none"
                        checked={selectedCategories.includes('no-category')}
                        onCheckedChange={() => toggleCategory('no-category')}
                      />
                      <label
                        htmlFor="category-none"
                        className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                      >
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                        Без категории
                      </label>
                    </div>
                  )}
                  {projectCategories.length === 0 && !hasTasksWithoutCategory && (
                    <p className="text-sm text-gray-500">Нет категорий</p>
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
                {/* Empty cell for category labels */}
                <div className="sticky left-0 w-40 bg-white z-20 border-r" />
                
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

            {/* Category groups */}
            {categoryGroups.map((group, groupIndex) => {
              const groupHeight = Math.max(40, group.rows.length * 60);
              
              return (
                <div key={group.categoryId || 'no-category'} className="border-b">
                  <div className="flex" style={{ minHeight: `${groupHeight}px` }}>
                    {/* Category label */}
                    <div className="sticky left-0 w-40 bg-white z-10 border-r p-3 flex items-start">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${group.categoryColor}`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {group.categoryName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {group.tasks.length} {group.tasks.length === 1 ? 'задача' : group.tasks.length < 5 ? 'задачи' : 'задач'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tasks area */}
                    <div className="flex-1 relative">
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
                      {group.rows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="relative h-[90px]"
                        >
                          {row.map(task => {
                            if (!isTaskVisible(task)) return null;
                            
                            const { left, width } = getTaskStyle(task);
                            
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
                                  {/* Header: icons */}
                                  <div className="flex items-center gap-1 min-h-[14px] justify-end">
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
                                  
                                  {/* Task title - крупнее и заметнее */}
                                  <div className={`text-sm text-gray-900 font-extrabold leading-tight truncate ${task.status === 'done' ? 'line-through' : ''}`}>
                                    {task.title}
                                  </div>
                                  
                                  {/* Assignee badge */}
                                  {task.assigneeId && (
                                    <div className="flex items-center gap-1 mt-auto">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                        <User className="w-2 h-2 mr-0.5" />
                                        {getAssigneeName(task.assigneeId)}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Tooltip on hover */}
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-20 shadow-xl border border-gray-700">
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
                                  <div className="text-purple-300 flex items-center gap-1 mb-1">
                                    <Tag className="w-3 h-3" />
                                    {getCategoryName(task.categoryId)}
                                  </div>
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
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {categoryGroups.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
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
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <span className="text-gray-600">На проверке</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-gray-600">Готово</span>
          </div>
        </div>
        <div className="text-gray-500">
          Всего задач: {projectTasks.length}
        </div>
        <div className="text-gray-500">
          Категорий: {categoryGroups.length}
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
