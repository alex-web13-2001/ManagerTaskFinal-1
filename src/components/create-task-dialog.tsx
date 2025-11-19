import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, X, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/auth-context';
import { useProjects } from '../contexts/projects-context';
import { Checkbox } from './ui/checkbox';

export function CreateTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { categories } = useAuth();
  const { projects } = useProjects();
  
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [project, setProject] = React.useState('');
  const [category, setCategory] = React.useState('none');
  const [assignee, setAssignee] = React.useState('');
  const [date, setDate] = React.useState<Date>();
  const [tags, setTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState('');
  // Поля для повторяющихся задач
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [recurringStartDate, setRecurringStartDate] = React.useState<Date>();
  const [recurringIntervalDays, setRecurringIntervalDays] = React.useState<number>(1);
  
  // Get selected project to filter categories
  const selectedProject = React.useMemo(() => {
    return projects.find((p) => p.id === project);
  }, [project, projects]);
  
  // Filter categories based on selected project
  const availableCategories = React.useMemo(() => {
    if (!project || project === 'personal') {
      // Personal tasks can use all user's categories
      return categories;
    }
    
    if (!selectedProject) {
      return [];
    }
    
    // Check if project has availableCategories defined
    const projectAvailableCategories = (selectedProject as any).availableCategories;
    
    if (!projectAvailableCategories || !Array.isArray(projectAvailableCategories) || projectAvailableCategories.length === 0) {
      // If no categories are assigned to the project, show empty list
      // Only owner can assign categories via project modal
      return [];
    }
    
    // Filter to only show categories available in this project
    return categories.filter(cat => projectAvailableCategories.includes(cat.id));
  }, [project, selectedProject, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Здесь будет логика создания задачи
    console.log({
      title,
      description,
      priority,
      project,
      category,
      assignee,
      date,
      tags,
    });
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setProject('');
    setCategory('none');
    setAssignee('');
    setDate(undefined);
    setTags([]);
    setNewTag('');
    setIsRecurring(false);
    setRecurringStartDate(undefined);
    setRecurringIntervalDays(1);
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать новую задачу</DialogTitle>
          <DialogDescription>
            Заполните информацию о новой задаче. Поля отмеченные * обязательны для заполнения.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">
              Название задачи <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Введите название задачи"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Описание</Label>
            <Textarea
              id="task-description"
              placeholder="Опишите задачу подробнее"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Проект <span className="text-red-500">*</span>
              </Label>
              <Select value={project} onValueChange={setProject} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Личные задачи</SelectItem>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Категория <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={category} 
                onValueChange={setCategory} 
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без категории</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Исполнитель</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите исполнителя" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ap">Александр Петров</SelectItem>
                  <SelectItem value="mi">Мария Иванова</SelectItem>
                  <SelectItem value="es">Евгений Смирнов</SelectItem>
                  <SelectItem value="dk">Дмитрий Козлов</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Срок выполнения (дедлайн)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Теги</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Добавить тег"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" onClick={addTag} size="sm">
                Добавить
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Повторяющаяся задача */}
          <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
              />
              <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer">
                <Repeat className="w-4 h-4 text-purple-600" />
                Повторяющаяся задача
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-4 mt-4 pl-6 border-l-2 border-purple-200">
                <div className="space-y-2">
                  <Label>Дата начала повторений</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurringStartDate ? format(recurringStartDate, 'PPP', { locale: ru }) : 'Выберите дату'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={recurringStartDate}
                        onSelect={setRecurringStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interval">Период повторения (в днях)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    value={recurringIntervalDays}
                    onChange={(e) => setRecurringIntervalDays(parseInt(e.target.value) || 1)}
                    placeholder="Введите количество дней"
                  />
                  <p className="text-xs text-gray-500">
                    Задача будет автоматически возобновляться каждые {recurringIntervalDays} {recurringIntervalDays === 1 ? 'день' : recurringIntervalDays < 5 ? 'дня' : 'дней'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={!title || !project || !category}
            >
              Создать задачу
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
