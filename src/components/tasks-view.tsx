import React from 'react';
import { LayoutGrid, Table as TableIcon, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { PersonalKanbanBoard } from './personal-kanban-board';
import { PersonalTaskTable } from './personal-task-table';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { motion, AnimatePresence } from 'framer-motion';

interface TasksViewProps {
  onTaskClick?: (taskId: string) => void;
}

export function TasksView({ onTaskClick }: TasksViewProps) {
  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>('kanban');
  
  // Фильтры: приоритет и дедлайн (без статуса)
  const [filters, setFilters] = React.useState<{
    priorities: string[];
    deadline: string;
  }>({
    priorities: [],
    deadline: 'all',
  });

  const handleTaskClick = (taskId: string) => {
    onTaskClick?.(taskId);
  };

  const toggleArrayFilter = (key: 'priorities', value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      priorities: [],
      deadline: 'all',
    });
  };

  const prioritiesList = [
    { id: 'high', name: 'Высокий' },
    { id: 'medium', name: 'Средний' },
    { id: 'low', name: 'Низкий' },
  ];

  const hasActiveFilters = filters.priorities.length > 0 || filters.deadline !== 'all';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Заголовок и фильтры */}
      <div className="border-b bg-white px-4 md:px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-gray-900 mb-1">Личные задачи</h1>
            <p className="text-gray-600 text-sm">Приватная доска для планирования личных дел</p>
          </div>
          
          {/* Переключатель режимов */}
          <div className="flex items-center gap-2 border rounded-lg p-1">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={viewMode === 'kanban' ? 'bg-purple-600' : ''}
            >
              <LayoutGrid className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Kanban</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={viewMode === 'table' ? 'bg-purple-600' : ''}
            >
              <TableIcon className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Таблица</span>
            </Button>
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

          {/* Приоритет */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Приоритет
                <AnimatePresence>
                  {filters.priorities.length > 0 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                        {filters.priorities.length}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
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

          {/* Дедлайн */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Дедлайн
                <AnimatePresence>
                  {filters.deadline !== 'all' && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                        1
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
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

      {/* Основная область */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'kanban' ? (
          <PersonalKanbanBoard filters={filters} onTaskClick={handleTaskClick} />
        ) : (
          <PersonalTaskTable filters={filters} onTaskClick={handleTaskClick} />
        )}
      </div>
    </div>
  );
}
