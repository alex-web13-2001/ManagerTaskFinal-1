import React from 'react';
import { createPortal } from 'react-dom';
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
import { Badge } from './ui/badge';
import { RichTextEditor } from './ui/rich-text-editor';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Calendar,
  Flame,
  Tag,
  User,
  Paperclip,
  Clock,
  Trash2,
  X,
  Upload,
  Download,
  History,
  Loader2,
  Repeat,
  MessageSquare,
  Send,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { tasksAPI } from '../utils/api-client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';
import { useProjects } from '../contexts/projects-context';
import { Checkbox } from './ui/checkbox';
import { ShareButton } from './share-button';
import { sanitizeHtml } from '../utils/sanitize-html';
import { markTaskAsRead } from '../hooks/useTaskNewBadge';
import { TagsInput } from './tags-input';
import { getColorForProject } from '../utils/colors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { TaskHistoryTimeline } from './task-history-timeline';
import { MentionAutocomplete } from './mention-autocomplete';
import type { TeamMember } from '../types';

type TaskModalMode = 'create' | 'view' | 'edit';

type TaskModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskModalMode;
  taskId?: string;
  initialProject?: string;
  onSave?: (task: any) => void;
  onDelete?: (taskId: string) => void;
};

// Helper to get initials from name
const getInitials = (name: string | undefined) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Helper to render comment text with highlighted mentions
function renderCommentWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[\w.-]+)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span 
          key={index} 
          className="text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/30 px-1 rounded"
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

const getTaskData = (id: string) => ({
  id,
  title: 'Разработать дизайн главной страницы',
  description:
    'Создать макеты главной страницы в Figma. Нужно учесть современные тренды дизайна и обеспечить удобство использования на различных устройствах.\n\nСсылки:\nhttps://figma.com/mockup\nhttps://dribbble.com/shots/inspiration',
  status: 'assigned',
  statusName: 'Назначено',
  priority: 'high',
  projectId: 'website',
  project: 'Веб-сайт',
  projectColor: 'bg-purple-500',
  categoryId: 'design',
  category: 'Дизайн',
  categoryColor: 'bg-pink-500',
  assigneeId: 'ap',
  assignee: 'Александр Петров',
  assigneeShort: 'АП',
  creatorId: 'mi',
  creator: 'Мария Иванова',
  creatorShort: 'МИ',
  dueDate: new Date('2024-11-15'),
  createdAt: '10 ноября 2024',
  updatedAt: '2 часа назад',
  tags: ['UI/UX', 'срочно', 'дизайн'],
  attachments: [
    { id: '1', name: 'mockup-v1.fig', size: '2.4 MB', url: '#' },
    { id: '2', name: 'requirements.pdf', size: '856 KB', url: '#' },
  ],
});

export function TaskModal({
  open,
  onOpenChange,
  mode: initialMode,
  taskId,
  initialProject,
  onSave,
  onDelete,
}: TaskModalProps) {
  const { currentUser, categories } = useAuth();
  const { 
    tasks, 
    loadTask,
    createTask, 
    updateTask, 
    deleteTask,
    uploadTaskAttachment,
    uploadMultipleTaskAttachments,
    deleteTaskAttachment,
    addTaskComment,
    canDeleteTask,
    canCreateTask,
  } = useTasks();
  const {
    projects,
    teamMembers,
    canEditProject,
    getUserRoleInProject,
    hasPermission,
    projectTags,
    personalTags,
    addProjectTag,
    addPersonalTag,
  } = useProjects();
  const [mode, setMode] = React.useState<TaskModalMode>(initialMode);
  const [isLoading, setIsLoading] = React.useState(false);
  const [projectCategories, setProjectCategories] = React.useState<any[]>([]);
  
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  const isCreateMode = mode === 'create';

  // Загрузка данных задачи для режима просмотра/редактирования
  const existingTask = taskId && !isCreateMode ? tasks.find(t => t.id === taskId) : null;
  
  // Проверка прав на удаление задачи с использованием context helper
  const canDelete = React.useMemo(() => {
    if (!existingTask) return false;
    return canDeleteTask(existingTask);
  }, [existingTask, canDeleteTask]);

  // Form state - ALL useState declarations BEFORE useEffect hooks to prevent TDZ errors
  const [title, setTitle] = React.useState(existingTask?.title || '');
  const [description, setDescription] = React.useState(existingTask?.description || '');
  const [projectId, setProjectId] = React.useState(existingTask?.projectId || initialProject || 'personal');
  const [categoryId, setCategoryId] = React.useState(existingTask?.categoryId || 'none');
  const [priority, setPriority] = React.useState(existingTask?.priority || 'medium');
  const [status, setStatus] = React.useState(existingTask?.status || 'todo');
  const [assigneeId, setAssigneeId] = React.useState(existingTask?.assigneeId || '');
  const [dueDate, setDueDate] = React.useState<Date | undefined>(
    existingTask?.deadline ? new Date(existingTask.deadline) : undefined
  );
  const [tags, setTags] = React.useState<string[]>(existingTask?.tags || []);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = React.useState(false);
  // Поля для повторяющихся задач
  const [isRecurring, setIsRecurring] = React.useState(existingTask?.isRecurring || false);
  const [recurringStartDate, setRecurringStartDate] = React.useState<Date | undefined>(
    existingTask?.recurringStartDate ? new Date(existingTask.recurringStartDate) : undefined
  );
  const [recurringIntervalDays, setRecurringIntervalDays] = React.useState<number>(
    existingTask?.recurringIntervalDays || 1
  );
  
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [customColumns, setCustomColumns] = React.useState<Array<{ id: string; title: string; color: string }>>([]);
  
  // Comment-related state
  const [commentText, setCommentText] = React.useState('');
  const [showAllComments, setShowAllComments] = React.useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  
  // Mention autocomplete state
  const [showMentionAutocomplete, setShowMentionAutocomplete] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionStartIndex, setMentionStartIndex] = React.useState(0);
  const commentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);
  const [commentFiles, setCommentFiles] = React.useState<File[]>([]);

  // History-related state
  const [taskHistory, setTaskHistory] = React.useState<Array<import('./task-history-timeline').TaskHistoryEntry>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  // Get available tags based on project context
  const availableTags = React.useMemo(() => {
    if (projectId === 'personal') {
      return personalTags;
    }
    return projectTags[projectId] || [];
  }, [projectId, projectTags, personalTags]);

  // Sort available tags by usage frequency (most used first)
  const sortedAvailableTags = React.useMemo(() => {
    const tagUsage = new Map<string, number>();
    
    tasks.forEach((task) => {
      task.tags?.forEach((tag) => {
        tagUsage.set(tag, (tagUsage.get(tag) || 0) + 1);
      });
    });
    
    return [...availableTags].sort((a, b) => {
      const usageA = tagUsage.get(a) || 0;
      const usageB = tagUsage.get(b) || 0;
      return usageB - usageA;
    });
  }, [availableTags, tasks]);

  // Get mentionable users (excluding viewers)
  const mentionableUsers = React.useMemo(() => {
    // For personal tasks, no mentions needed
    if (projectId === 'personal') {
      return [];
    }

    const selectedProject = projects.find(p => p.id === projectId);
    if (!selectedProject?.members) {
      return [];
    }

    // Collect IDs of members in the current project
    const projectMemberIds = new Set<string>();
    const viewerIds = new Set<string>();
    
    selectedProject.members.forEach((member: any) => {
      const memberId = member.userId || member.id;
      if (memberId) {
        projectMemberIds.add(memberId);
        if (member.role === 'viewer') {
          viewerIds.add(memberId);
        }
      }
    });

    // Filter: only members of current project AND not viewers
    return teamMembers.filter(member => 
      projectMemberIds.has(member.id) && !viewerIds.has(member.id)
    );
  }, [projectId, projects, teamMembers]);

  // Debug: log every render - NOW projectId and assigneeId are declared
  React.useEffect(() => {
    console.log('🔄 TaskModal render:', {
      mode,
      taskId,
      open,
      assigneeId,
      projectId,
      timestamp: new Date().toISOString(),
    });
  });

  // Reset mode when modal closes/opens
  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode, open]);
  
  // Load task details when modal opens for view/edit mode
  // This ensures comments and other data are fresh from the server
  React.useEffect(() => {
    if (open && taskId && !isCreateMode) {
      console.log(`🔄 Loading task ${taskId} with comments`);
      loadTask(taskId);
      // Also load task history
      loadTaskHistory(taskId);
    }
  }, [open, taskId, isCreateMode, loadTask]);
  
  // Mark task as read when modal opens (for NEW badge feature)
  React.useEffect(() => {
    if (open && taskId && !isCreateMode) {
      markTaskAsRead(taskId);
    }
  }, [open, taskId, isCreateMode]);
  
  // Close mention autocomplete when Dialog closes
  React.useEffect(() => {
    if (!open) {
      setShowMentionAutocomplete(false);
    }
  }, [open]);
  
  // ISSUE #5 FIX: Track when projects or teamMembers update for real-time member list updates
  React.useEffect(() => {
    if (open && projectId && projectId !== 'personal') {
      const project = projects.find(p => p.id === projectId);
      console.log('🔄 ISSUE #5: Projects/TeamMembers updated while modal is open:', {
        projectId,
        projectMembersCount: project?.members?.length || 0,
        projectMembers: project?.members?.map((m: any) => ({ 
          id: m.userId || m.id, 
          name: m.name || m.email,
          role: m.role 
        })) || [],
        teamMembersCount: teamMembers.length,
        teamMembers: teamMembers.map(m => ({ id: m.id, name: m.name })),
        timestamp: new Date().toISOString(),
      });
    }
  }, [projects, teamMembers, open, projectId]);

  // Load custom columns from localStorage
  React.useEffect(() => {
    if (currentUser) {
      const stored = localStorage.getItem(`personal-custom-columns-${currentUser.id}`);
      if (stored) {
        try {
          setCustomColumns(JSON.parse(stored));
        } catch (e) {
          console.error('Error loading custom columns:', e);
          setCustomColumns([]);
        }
      } else {
        setCustomColumns([]);
      }
    }
  }, [currentUser, open]); // Перезагружаем при открытии модалки

  // Track if form has been initialized to prevent re-setting values
  const formInitializedRef = React.useRef<string | null>(null);
  
  // Update form when switching modes or task changes
  React.useEffect(() => {
    const currentTaskId = existingTask?.id || 'create';
    const shouldInitialize = formInitializedRef.current !== currentTaskId || !open;
    
    if (existingTask && shouldInitialize) {
      console.log('📝 Обновление формы из existingTask:', {
        taskId: existingTask.id,
        title: existingTask.title,
        projectId: existingTask.projectId || 'personal',
        assigneeId: existingTask.assigneeId,
      });
      
      setTitle(existingTask.title || '');
      setDescription(existingTask.description || '');
      setProjectId(existingTask.projectId || 'personal');
      setCategoryId(existingTask.categoryId || 'none');
      setPriority(existingTask.priority || 'medium');
      setStatus(existingTask.status || 'todo');
      setAssigneeId(existingTask.assigneeId || '');
      setDueDate(existingTask.deadline ? new Date(existingTask.deadline) : undefined);
      setTags(existingTask.tags || []);
      
      formInitializedRef.current = currentTaskId;
    } else if (isCreateMode && shouldInitialize) {
      console.log('📝 Инициализация формы для создания задачи, initialProject:', initialProject);
      setProjectId(initialProject || 'personal');
      setCategoryId('none');
      formInitializedRef.current = currentTaskId;
    }
  }, [existingTask, isCreateMode, initialProject, open]);
  
  // Reset formInitializedRef when modal closes
  React.useEffect(() => {
    if (!open) {
      formInitializedRef.current = null;
    }
  }, [open]);

  // Auto-assign current user for personal tasks (only when projectId changes)
  const prevProjectIdRef = React.useRef(projectId);
  React.useEffect(() => {
    // Только если projectId реально изменился
    if (prevProjectIdRef.current !== projectId) {
      console.log('🔄 projectId изменился:', {
        from: prevProjectIdRef.current,
        to: projectId,
        isPersonal: projectId === 'personal',
        isEditMode: !!taskId,
        currentAssigneeId: assigneeId,
      });
      
      if (projectId === 'personal' && currentUser) {
        // Для "Личные задачи" автоматически назначаем текущего пользователя
        console.log('  → Устанавливаем assigneeId в', currentUser.id, '(текущий пользователь для личных задач)');
        setAssigneeId(currentUser.id);
      } else if (projectId !== 'personal' && !taskId) {
        // При переключении на другой проект (и это создание новой задачи),
        // очищаем исполнителя только если это не редактирование
        console.log('  → Очищаем assigneeId (переключение на проект при создании задачи)');
        setAssigneeId('');
      } else {
        console.log('  → Оставляем assigneeId без изменений (редактирование задачи)');
      }
      prevProjectIdRef.current = projectId;
    }
  }, [projectId, currentUser, taskId]); // УБРАЛИ assigneeId из зависимостей!

  const resetForm = () => {
    setTitle('');
    setDescription('');
    const newProjectId = initialProject || 'personal';
    setProjectId(newProjectId);
    setCategoryId('none');
    setPriority('medium');
    setStatus('todo');
    // Если сброс формы для личных задач, устанавливаем текущего пользователя
    setAssigneeId(newProjectId === 'personal' && currentUser ? currentUser.id : '');
    setDueDate(undefined);
    setTags([]);
    setPendingFiles([]);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Название обязательно для заполнения';
    }
    if (!projectId) {
      newErrors.project = 'Выберите проект';
    }
    if (isRecurring && !recurringStartDate) {
      newErrors.recurringStartDate = 'Дата начала обязательна для повторяющихся задач';
      toast.error('Укажите дату начала для повторяющейся задачи');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Заполните обязательные поля');
      return;
    }

    // Проверка прав для создания задачи
    if (isCreateMode && projectId !== 'personal') {
      if (!canCreateTask(projectId)) {
        const role = getUserRoleInProject(projectId);
        toast.error(`У вас нет прав для создания задач в этом проекте (роль: ${role === 'viewer' ? 'Наблюдатель' : role})`);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Для личных задач всегда устанавливаем исполнителя как текущего пользователя
      const finalAssigneeId = projectId === 'personal' && currentUser 
        ? currentUser.id 
        : (assigneeId || undefined);

      // Для повторяющихся задач: если это создание задачи и не установлен deadline,
      // рассчитываем его автоматически
      let finalDeadline = dueDate?.toISOString();
      if (isRecurring && recurringStartDate) {
        console.log('🔄 Расчет дедлайна для повторяющейся задачи:', {
          isCreateMode,
          hasDueDate: !!dueDate,
          recurringStartDate: recurringStartDate.toISOString(),
          recurringStartDateLocal: recurringStartDate.toString(),
          recurringIntervalDays,
        });
        
        // Если не установлен вручную дедлайн, рассчитываем автоматически
        if (!dueDate) {
          // Нормализуем дату начала - устанавливаем время в полдень локального времени
          // чтобы избежать проблем с часовыми поясами
          const normalizedStart = new Date(recurringStartDate);
          normalizedStart.setHours(12, 0, 0, 0);
          
          // Рассчитываем дедлайн
          const calculatedDeadline = new Date(normalizedStart);
          calculatedDeadline.setDate(calculatedDeadline.getDate() + (recurringIntervalDays || 1));
          
          finalDeadline = calculatedDeadline.toISOString();
          console.log('🔄 Автоматически рассчитан deadline:', {
            startDate: recurringStartDate.toISOString(),
            normalizedStart: normalizedStart.toISOString(),
            startDateReadable: format(normalizedStart, 'PPP', { locale: ru }),
            intervalDays: recurringIntervalDays,
            calculatedDeadline: finalDeadline,
            calculatedDateReadable: format(calculatedDeadline, 'PPP', { locale: ru }),
          });
        }
      }

      const taskData = {
        title,
        description,
        projectId: projectId === 'personal' ? null : projectId,
        categoryId: categoryId === 'none' ? undefined : categoryId,
        priority,
        status,
        assigneeId: finalAssigneeId,
        deadline: finalDeadline,
        tags,
        completed: status === 'done',
        // Добавляем поля для повторяющихся задач
        isRecurring,
        recurringStartDate: isRecurring ? recurringStartDate?.toISOString() : undefined,
        recurringIntervalDays: isRecurring ? recurringIntervalDays : undefined,
      };

      console.log('📝 TaskModal - Creating/updating task:', {
        mode: isCreateMode ? 'create' : 'edit',
        taskData,
        initialProject,
        selectedProjectId: projectId,
        isPersonal: projectId === 'personal',
        assigneeId,
        finalAssigneeId,
        availableMembers: availableMembersWithCurrent.map(m => ({ id: m.id, name: m.name })),
      });

      let savedTask;
      if (isCreateMode) {
        savedTask = await createTask(taskData);
        console.log('✅ Task created:', savedTask);
        if (savedTask.deadline) {
          console.log('📅 Saved task deadline:', {
            raw: savedTask.deadline,
            parsed: new Date(savedTask.deadline).toISOString(),
            readable: format(new Date(savedTask.deadline), 'PPP', { locale: ru }),
          });
        }
        onSave?.(taskData);
      } else if (existingTask) {
        savedTask = await updateTask(existingTask.id, taskData);
        console.log('✅ Task updated:', savedTask);
        if (savedTask.deadline) {
          console.log('📅 Updated task deadline:', {
            raw: savedTask.deadline,
            parsed: new Date(savedTask.deadline).toISOString(),
            readable: format(new Date(savedTask.deadline), 'PPP', { locale: ru }),
          });
        }
        onSave?.(taskData);
      }

      // Upload pending files
      if (pendingFiles.length > 0 && savedTask) {
        setIsUploadingFiles(true);
        console.log(`📎 Uploading ${pendingFiles.length} file(s) for task ${savedTask.id}`);
        
        try {
          // Upload all files at once instead of one by one
          const uploadedAttachments = await tasksAPI.uploadMultipleAttachments(savedTask.id, pendingFiles);
          console.log(`✅ Successfully uploaded ${uploadedAttachments.length} files`);
          toast.success(`Загружено файлов: ${uploadedAttachments.length}`);
        } catch (uploadError: any) {
          console.error(`❌ File upload error:`, uploadError);
          toast.error(`Ошибка загрузки файлов: ${uploadError.message || 'Неизвестная ошибка'}`);
        } finally {
          setIsUploadingFiles(false);
          setPendingFiles([]);
        }
        
        console.log(`📎 Upload complete`);
      }
      
      // ✅ Close modal ONLY after ALL operations are complete
      if (isCreateMode) {
        resetForm();
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('Task save error:', error);
      // Показываем сообщение об ошибке пользователю
      toast.error(error?.message || 'Ошибка при сохранении задачи');
      // НЕ закрываем модалку при ошибке, чтобы пользователь мог исправить данные
    } finally {
      setIsLoading(false);
      setIsUploadingFiles(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    
    setIsLoading(true);
    try {
      await deleteTask(taskId);
      onDelete?.(taskId);
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Task delete error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = async (tag: string) => {
    const tagToAdd = tag.trim();
    
    // Validation
    if (!tagToAdd) {
      return;
    }
    
    if (tagToAdd.length > 30) {
      toast.error('Тег не может быть длиннее 30 символов');
      return;
    }
    
    if (tags.includes(tagToAdd)) {
      toast.error('Этот тег уже добавлен');
      return;
    }
    
    // Add tag to local state
    setTags([...tags, tagToAdd]);
    
    // Auto-add new tag to dictionary if it doesn't exist
    if (!availableTags.includes(tagToAdd)) {
      try {
        if (projectId === 'personal') {
          await addPersonalTag(tagToAdd);
        } else {
          await addProjectTag(projectId, tagToAdd);
        }
      } catch (error: any) {
        // Tag still added to task, just not to dictionary
        console.error('Failed to add tag to dictionary:', error);
        // Don't show error toast as it's not critical
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      
      // Validate file sizes
      const oversizedFiles = newFiles.filter(f => f.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        toast.error('Некоторые файлы превышают максимальный размер 10MB');
        return;
      }
      
      setPendingFiles([...pendingFiles, ...newFiles]);
    }
    e.target.value = ''; // Reset input
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  };

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    if (!existingTask) return;
    
    try {
      setIsLoading(true);
      // FIX Problem #4: Add await and proper error handling
      await tasksAPI.deleteAttachment(existingTask.id, attachmentId);
      console.log(`✅ File deleted successfully: ${attachmentId}`);
      // The task list will be automatically updated by the context
      // which will trigger a re-render with updated existingTask
    } catch (error) {
      console.error('❌ Delete attachment error:', error);
      toast.error('Ошибка при удалении файла');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a stable username from user's name and email
  const getUsernameForMention = (user: TeamMember): string => {
    // Use first part of email (before @) as it's usually unique
    if (!user.email || !user.email.includes('@')) {
      // Fallback to user ID if email is invalid
      return user.id.replace(/[^\w.-]/g, '');
    }
    const emailPrefix = user.email.split('@')[0];
    // Sanitize to only allow word characters, dots, and hyphens
    return emailPrefix.replace(/[^\w.-]/g, '');
  };

  // Extract mentioned usernames from comment text
  const extractMentionedUsers = (text: string): string[] => {
    const mentionRegex = /@([\w.-]+)/g;
    const mentions: string[] = [];
    const mentionedUsernames = new Set<string>();
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      // Skip if we already processed this username
      if (mentionedUsernames.has(username)) continue;
      
      // Find user by matching username with email prefix
      const user = mentionableUsers.find(u => {
        if (!u.email || !u.email.includes('@')) return false;
        const emailPrefix = u.email.split('@')[0].replace(/[^\w.-]/g, '');
        return emailPrefix === username;
      });
      
      if (user && !mentions.includes(user.id)) {
        mentions.push(user.id);
        mentionedUsernames.add(username);
      }
    }
    
    return mentions;
  };

  // Handle textarea change for mention detection
  const handleCommentTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setCommentText(value);
    
    // Check if there's an @ before the cursor
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([\w.-]*)$/);
    
    if (match) {
      setMentionQuery(match[1]);
      setMentionStartIndex(cursorPos - match[0].length);
      setShowMentionAutocomplete(true);
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (user: TeamMember) => {
    if (!commentTextareaRef.current) return;
    
    const textarea = commentTextareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeMention = commentText.slice(0, mentionStartIndex);
    const textAfterCursor = commentText.slice(cursorPos);
    
    // Get username using the helper function
    const username = getUsernameForMention(user);
    const newText = `${textBeforeMention}@${username} ${textAfterCursor}`;
    
    setCommentText(newText);
    setShowMentionAutocomplete(false);
    
    // Set cursor position after the mention
    setTimeout(() => {
      const newCursorPos = mentionStartIndex + username.length + 2; // +2 for @ and space
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleCommentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCommentFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      // Clear input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitComment = async () => {
    if ((!commentText || !commentText.trim()) && commentFiles.length === 0) return;
    if (!existingTask) return;
    
    setIsSubmittingComment(true);
    try {
      // Extract mentioned users from the comment text
      const mentionedUsers = extractMentionedUsers(commentText.trim());
      
      await addTaskComment(existingTask.id, commentText.trim(), mentionedUsers, commentFiles);
      setCommentText('');
      setCommentFiles([]);
      setShowMentionAutocomplete(false);
      toast.success('Комментарий добавлен');
      // Reload history to show the comment event
      loadTaskHistory(existingTask.id);
    } catch (error) {
      console.error('❌ Add comment error:', error);
      toast.error('Ошибка при добавлении комментария');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When autocomplete is open, prevent default for arrows to avoid cursor movement
    // but NOT for Enter - MentionAutocomplete will handle these via document listener
    if (showMentionAutocomplete) {
      // For arrows, prevent cursor movement in textarea
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
      // For Enter - do NOT call preventDefault so the event reaches document
      return;
    }
    
    // Submit on Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (commentText.trim() && !isSubmittingComment) {
        handleSubmitComment();
      }
    }
  };

  const loadTaskHistory = async (taskId: string) => {
    setIsLoadingHistory(true);
    console.log('📜 Loading task history for:', taskId);
    
    try {
      const data = await tasksAPI.getHistory(taskId);
      
      console.log('📜 Task history loaded successfully:', {
        taskId,
        historyCount: data.history?.length || 0,
        firstEntry: data.history?.[0],
        isEmpty: !data.history || data.history.length === 0,
      });
      
      setTaskHistory(data.history || []);
    } catch (error: any) {
      console.error('💥 Error loading task history:', error);
      
      // Handle auth errors specifically
      if (error.message?.includes('401') || error.message?.includes('authenticated')) {
         toast.error('Сессия истекла. Войдите заново');
      } else {
         toast.error(error.message || 'Ошибка загрузки истории задачи');
      }
      
      setTaskHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const renderDescription = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const selectedProject = React.useMemo(() => {
    return projectId === 'personal' 
      ? { id: 'personal', name: 'Личные задачи', color: 'gray' }
      : projects.find((p) => p.id === projectId);
  }, [projectId, projects]);
  
  const selectedCategory = React.useMemo(() => {
    // For project tasks, search in projectCategories first, then fallback to categories
    // This ensures the category is found even when viewing a task before project categories are loaded
    if (projectId && projectId !== 'personal' && projectCategories.length > 0) {
      const projCat = projectCategories.find((c) => c.id === categoryId);
      if (projCat) return projCat;
    }
    
    // Check user's own categories
    const userCategory = categories.find((c) => c.id === categoryId);
    if (userCategory) return userCategory;
    
    // ISSUE #1 FIX: If category not found in loaded categories, check if task has category data embedded
    // This handles the case when viewing a task before projectCategories are loaded
    if (existingTask?.category) {
      return {
        id: categoryId || existingTask.categoryId || 'none',
        name: typeof existingTask.category === 'string' ? existingTask.category : existingTask.category.name,
        color: typeof existingTask.category === 'object' && existingTask.category.color 
          ? existingTask.category.color 
          : 'bg-gray-500',
      };
    }
    
    return undefined;
  }, [categories, categoryId, projectId, projectCategories, existingTask]);
  
  // Load project categories when project changes
  React.useEffect(() => {
    if (projectId && projectId !== 'personal' && selectedProject) {
      // Fetch categories for this project (owner's categories filtered by availableCategories)
      const loadProjectCategories = async () => {
        try {
          const { projectsAPI } = await import('../utils/api-client');
          const cats = await projectsAPI.getProjectCategories(projectId);
          setProjectCategories(cats);
        } catch (error) {
          console.error('Failed to load project categories:', error);
          setProjectCategories([]);
        }
      };
      loadProjectCategories();
    } else {
      setProjectCategories([]);
    }
  }, [projectId, selectedProject]);
  
  // Filter categories to show only categories available in the selected project
  // For project tasks, use categories from the project owner (filtered by availableCategories)
  const availableCategories = React.useMemo(() => {
    if (projectId === 'personal') {
      // Personal tasks can use all user's categories
      return categories;
    }
    
    if (!selectedProject || selectedProject.id === 'personal') {
      return categories;
    }
    
    // For project tasks: ONLY use project categories from the owner
    // These are already filtered by project.availableCategories on the server
    // Do NOT fallback to current user's categories - members should only see owner's categories
    return projectCategories;
  }, [projectId, selectedProject, categories, projectCategories]);
  
  // Reset category if it's not available in the selected project
  React.useEffect(() => {
    if (categoryId && categoryId !== 'none') {
      const isCategoryAvailable = availableCategories.some(cat => cat.id === categoryId);
      if (!isCategoryAvailable) {
        console.log(`⚠️ Категория ${categoryId} недоступна в проекте, сбрасываем на "none"`);
        setCategoryId('none');
      }
    }
  }, [projectId, availableCategories, categoryId]);
  
  // Filter team members to show only members of the selected project
  // Use a stable list that includes current assigneeId without causing re-renders
  const availableMembers = React.useMemo(() => {
    if (projectId === 'personal') {
      return []; // Personal tasks don't need assignee selection
    }
    
    if (!selectedProject || !selectedProject.id || selectedProject.id === 'personal') {
      return teamMembers;
    }
    
    // Build a map of all available members
    const membersMap = new Map();
    
    // First, add all teamMembers who are part of this project
    // Add project owner from teamMembers
    if (selectedProject.userId) {
      const ownerMember = teamMembers.find(m => m.id === selectedProject.userId);
      if (ownerMember) {
        membersMap.set(ownerMember.id, ownerMember);
      }
    }
    
    // Add project members from teamMembers
    if (selectedProject.members && Array.isArray(selectedProject.members)) {
      selectedProject.members.forEach((member: any) => {
        // Real members (added via invitation) have userId
        const memberId = member.userId || member.id;
        if (memberId) {
          const teamMember = teamMembers.find(m => m.id === memberId);
          if (teamMember) {
            membersMap.set(teamMember.id, teamMember);
          }
        }
      });
    }
    
    // CRITICAL FIX: If a member is in project.members but not in teamMembers,
    // create a temporary member object from project.members data
    if (selectedProject.members && Array.isArray(selectedProject.members)) {
      selectedProject.members.forEach((member: any) => {
        const memberId = member.userId || member.id;
        if (memberId && !membersMap.has(memberId)) {
          console.log(`⚠️ Member ${memberId} (${member.name || member.email}) is in project.members but not in teamMembers, creating temporary member object`);
          membersMap.set(memberId, {
            id: memberId,
            name: member.name || member.email,
            email: member.email,
            avatarUrl: member.avatar || member.avatarUrl,
          });
        }
      });
    }
    
    // FIX Problem #4: ALWAYS include current user if they have access to the project
    // This ensures the current user can assign tasks to themselves
    if (currentUser && !membersMap.has(currentUser.id)) {
      console.log(`✅ Adding current user ${currentUser.name} to available assignees (Problem #4 fix)`);
      membersMap.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
      });
    }
    
    // Also include existing task assignee (from existingTask, not current assigneeId state)
    // This prevents re-renders when assigneeId changes
    if (existingTask?.assigneeId && !membersMap.has(existingTask.assigneeId)) {
      console.log(`⚠️ Task assignee ${existingTask.assigneeId} is not in available members`);
      // Try to find in project members first
      const projectMember = selectedProject.members?.find((m: any) => 
        m.userId === existingTask.assigneeId || m.id === existingTask.assigneeId
      );
      if (projectMember) {
        const memberId = projectMember.userId || projectMember.id;
        membersMap.set(memberId, {
          id: memberId,
          name: projectMember.name || projectMember.email,
          email: projectMember.email,
          avatarUrl: projectMember.avatar || projectMember.avatarUrl,
        });
      } else {
        // Last resort: try to find in all teamMembers
        const teamMember = teamMembers.find(m => m.id === existingTask.assigneeId);
        if (teamMember) {
          membersMap.set(teamMember.id, teamMember);
        }
      }
    }
    
    const result = Array.from(membersMap.values());
    
    // Log for debugging
    console.log('🔍 availableMembers пересчитан для проекта', selectedProject?.name, ':', {
      projectId,
      projectUserId: selectedProject.userId,
      projectMembersCount: selectedProject.members?.length || 0,
      teamMembersCount: teamMembers.length,
      resultCount: result.length,
      result: result.map(m => ({ id: m.id, name: m.name })),
      existingAssigneeId: existingTask?.assigneeId,
      timestamp: new Date().toISOString(),
    });
    
    return result;
  }, [projectId, selectedProject, teamMembers, existingTask]);
  
  // Создаем расширенный список availableMembers, который включает текущий assigneeId
  // Это предотвращает сброс значения в Select
  const availableMembersWithCurrent = React.useMemo(() => {
    if (!assigneeId || projectId === 'personal') {
      return availableMembers;
    }
    
    // Проверяем, есть ли assigneeId в списке
    const memberExists = availableMembers.some(m => m.id === assigneeId);
    if (memberExists) {
      return availableMembers;
    }
    
    // Если нет, пытаемся добавить из project.members
    console.log(`⚠️ Current assigneeId ${assigneeId} not in availableMembers, trying to add`);
    
    const projectMember = selectedProject?.members?.find((m: any) => 
      m.userId === assigneeId || m.id === assigneeId
    );
    
    if (projectMember) {
      const memberId = projectMember.userId || projectMember.id;
      const tempMember = {
        id: memberId,
        name: projectMember.name || projectMember.email,
        email: projectMember.email,
        avatarUrl: projectMember.avatar || projectMember.avatarUrl,
      };
      console.log(`  → Добавлен временный участник:`, tempMember);
      return [...availableMembers, tempMember];
    }
    
    // Last resort: try to find in all teamMembers
    const teamMember = teamMembers.find(m => m.id === assigneeId);
    if (teamMember) {
      console.log(`  → Добавлен участник из teamMembers:`, teamMember);
      return [...availableMembers, teamMember];
    }
    
    console.warn(`  ❌ Не удалось найти участника с id ${assigneeId}`);
    return availableMembers;
  }, [availableMembers, assigneeId, projectId, selectedProject, teamMembers]);
  
  const selectedAssignee = availableMembersWithCurrent.find((m) => m.id === assigneeId);
  
  // Найти автора задачи (creatorId/userId)
  const taskAuthor = React.useMemo(() => {
    if (!existingTask?.creatorId && !existingTask?.userId && !existingTask?.creator) return null;
    
    // Сначала ищем в teamMembers
    let author = teamMembers.find(m => m.id === (existingTask.creatorId || existingTask.userId));
    
    // Если не нашли, проверяем, не является ли автором текущий пользователь
    if (!author && currentUser?.id === (existingTask.creatorId || existingTask.userId)) {
      author = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
      };
    }
    
    // Если creator объект уже есть в existingTask, используем его напрямую
    if (!author && existingTask.creator) {
      author = existingTask.creator;
    }
    
    // Если все еще не нашли, пробуем найти в project.members
    if (!author && existingTask.projectId && selectedProject?.members) {
      const projectMember = selectedProject.members.find((m: any) => 
        m.userId === (existingTask.creatorId || existingTask.userId) || m.id === (existingTask.creatorId || existingTask.userId)
      );
      if (projectMember) {
        author = {
          id: projectMember.userId || projectMember.id,
          name: projectMember.name || projectMember.email,
          email: projectMember.email,
          avatarUrl: projectMember.avatar || projectMember.avatarUrl,
        };
      }
    }
    
    return author;
  }, [existingTask, teamMembers, currentUser, selectedProject]);
  
  const existingAttachments = existingTask?.attachments || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" hideCloseButton={isViewMode}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {!isViewMode && (
                  <DialogTitle>
                    {isCreateMode ? 'Создать новую задачу' : 'Редактировать задачу'}
                  </DialogTitle>
                )}
                {isViewMode && existingTask && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedProject && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <div className={`w-2 h-2 rounded-full ${getColorForProject(selectedProject.color)} mr-1`} />
                          {selectedProject.name}
                        </Badge>
                      )}
                      {selectedCategory && selectedCategory.id !== 'none' && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                          <Tag className="w-3 h-3 mr-1" />
                          {selectedCategory.name}
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-2xl">{existingTask.title}</DialogTitle>
                  </>
                )}
                <DialogDescription className="sr-only">
                  {isCreateMode && 'Создание новой задачи'}
                  {isEditMode && 'Редактирование задачи'}
                  {isViewMode && 'Просмотр задачи'}
                </DialogDescription>
              </div>
              {isViewMode && existingTask && (
                <ShareButton 
                  url={existingTask.projectId 
                    ? `/projects/${existingTask.projectId}/tasks/${existingTask.id}`
                    : `/tasks/${existingTask.id}`
                  }
                  title={existingTask.title}
                />
              )}
              {isEditMode && canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowDeleteDialog(true)}
                  title="Удалить задачу"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* VIEW MODE */}
          {isViewMode && existingTask && (
            <div className="space-y-6 mt-4">
              {/* Основная информация */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  {dueDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Дедлайн:</span>
                      <span className="text-red-600">
                        {format(dueDate, 'PPP', { locale: ru })}
                      </span>
                    </div>
                  )}

                  {existingTask.isRecurring && (
                    <div className="col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Repeat className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-purple-900">Повторяющаяся задача</span>
                      </div>
                      <div className="text-sm text-purple-800 space-y-1">
                        {existingTask.recurringStartDate && (
                          <p>
                            Дата начала: <strong>{format(new Date(existingTask.recurringStartDate), 'PPP', { locale: ru })}</strong>
                          </p>
                        )}
                        {existingTask.recurringIntervalDays && (
                          <p>
                            Интервал повторения: <strong>{existingTask.recurringIntervalDays} {existingTask.recurringIntervalDays === 1 ? 'день' : 'дней'}</strong>
                          </p>
                        )}
                        <p className="text-xs text-purple-600 mt-2">
                          💡 Задача автоматически возобновляется после завершения
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Flame className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">Приоритет:</span>
                    <Badge variant="outline" className={
                      existingTask.priority === 'low' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                      existingTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                      existingTask.priority === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                      'bg-orange-100 text-orange-700 border-orange-300'
                    }>
                      {existingTask.priority === 'urgent' && (
                        <Flame className="w-3 h-3 mr-1 fill-current" />
                      )}
                      {existingTask.priority === 'urgent' && 'Срочный'}
                      {existingTask.priority === 'high' && 'Высокий'}
                      {existingTask.priority === 'medium' && 'Средний'}
                      {existingTask.priority === 'low' && 'Низкий'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Статус:</span>
                    <Badge variant="outline" className={
                      status === 'todo' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                      status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      status === 'review' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                      status === 'done' ? 'bg-green-100 text-green-700 border-green-300' :
                      'bg-purple-100 text-purple-700 border-purple-300'
                    }>
                      {status === 'todo' && 'К выполнению'}
                      {status === 'in_progress' && 'В работе'}
                      {status === 'review' && 'На проверке'}
                      {status === 'done' && 'Готово'}
                      {!['todo', 'in_progress', 'review', 'done'].includes(status) && 
                        (customColumns.find(col => col.id === status)?.title || status)
                      }
                    </Badge>
                  </div>

                  {selectedAssignee && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Исполнитель:</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {selectedAssignee?.avatarUrl && (
                            <AvatarImage src={selectedAssignee.avatarUrl} alt={selectedAssignee.name} />
                          )}
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                            {getInitials(selectedAssignee?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{selectedAssignee?.name || 'Unknown'}</span>
                      </div>
                    </div>
                  )}

                  {existingTask.categoryId && existingTask.categoryId !== 'none' ? (() => {
                    // FIX: Use same approach as kanban-board to find category by ID
                    const categoriesToUse = availableCategories || categories;
                    const category = categoriesToUse.find((c) => c.id === existingTask.categoryId);
                    return category ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">Категория:</span>
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                          {category.name}
                        </Badge>
                      </div>
                    ) : null;
                  })() : null}
                </div>

                <div className="space-y-3">
                  {taskAuthor && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Автор:</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {taskAuthor?.avatarUrl && (
                            <AvatarImage src={taskAuthor.avatarUrl} alt={taskAuthor.name} />
                          )}
                          <AvatarFallback className="text-xs bg-green-100 text-green-700">
                            {getInitials(taskAuthor?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{taskAuthor.id === currentUser?.id ? 'Вы' : (taskAuthor.name || 'Unknown')}</span>
                      </div>
                    </div>
                  )}
                
                  {existingTask.createdAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Создано:</span>
                      <span className="text-sm">
                        {format(new Date(existingTask.createdAt), 'PPP', { locale: ru })}
                      </span>
                    </div>
                  )}

                  {existingTask.updatedAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Обновлено:</span>
                      <span className="text-sm">
                        {format(new Date(existingTask.updatedAt), 'PPP', { locale: ru })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Описание */}
              {description && (
                <div>
                  <h4 className="mb-2">Описание</h4>
                  <div 
                    className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
                  />
                </div>
              )}

              {/* Теги */}
              {tags && tags.length > 0 && (
                <div>
                  <h4 className="mb-2">Теги</h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Вложения */}
              {existingAttachments && existingAttachments.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="w-4 h-4" />
                    <h4>Вложения ({existingAttachments.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {existingAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm" title={attachment.name}>
                              {attachment.name.length > 25 
                                ? `${attachment.name.slice(0, 15)}...${attachment.name.slice(-7)}`
                                : attachment.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                              {attachment.uploadedBy && (
                                <span className="ml-2 pl-2 border-l border-gray-300">
                                  Загрузил: {attachment.uploadedBy}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            
                            // Build full URL for attachment download
                            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
                            const fullUrl = attachment.url.startsWith('http') 
                              ? attachment.url 
                              : `${API_BASE_URL}${attachment.url}`;
                            
                            // Create a temporary link element to trigger download
                            const link = document.createElement('a');
                            link.href = fullUrl;
                            link.download = attachment.name; // Set filename for download
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Скачать
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Комментарии и История */}
              {existingTask && (
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="comments" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Комментарии ({existingTask.comments?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                      <History className="w-4 h-4" />
                      История
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="comments" className="space-y-4 mt-4">
                    {/* Форма добавления комментария */}
                    <div className="space-y-2 relative">
                      <Textarea
                        ref={commentTextareaRef}
                        placeholder="Напишите комментарий... (используйте @ для упоминания участников)"
                        value={commentText}
                        onChange={handleCommentTextChange}
                        onKeyDown={handleCommentKeyDown}
                        className="min-h-[80px]"
                        disabled={isSubmittingComment}
                      />
                      
                      {/* Mention Autocomplete - render outside Dialog using Portal */}
                      {showMentionAutocomplete && createPortal(
                        <MentionAutocomplete
                          users={mentionableUsers}
                          onSelect={handleMentionSelect}
                          searchQuery={mentionQuery}
                          textareaRef={commentTextareaRef}
                          onClose={() => setShowMentionAutocomplete(false)}
                        />,
                        document.body
                      )}

                      {/* Comment Files Preview */}
                      {commentFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {commentFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs border border-gray-200 dark:border-gray-700">
                                                <span className="text-xs truncate max-w-[150px]" title={file.name}>
                                                  {file.name.length > 20 
                                                    ? `${file.name.slice(0, 10)}...${file.name.slice(-7)}`
                                                    : file.name}
                                                </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 text-gray-500 hover:text-red-500"
                                onClick={() => removeCommentFile(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <div>
                          <input
                             type="file"
                             ref={commentFileInputRef}
                             className="hidden"
                             multiple
                             onChange={handleCommentFileSelect}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => commentFileInputRef.current?.click()}
                          >
                            <Paperclip className="w-4 h-4 mr-1" />
                            Прикрепить
                          </Button>
                        </div>

                        <Button
                          onClick={handleSubmitComment}
                          disabled={(!commentText.trim() && commentFiles.length === 0) || isSubmittingComment}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {isSubmittingComment ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Отправка...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Отправить
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Список комментариев */}
                    {existingTask.comments && existingTask.comments.length > 0 && (
                      <div className="space-y-3">
                        {(() => {
                          const comments = existingTask.comments;
                          const sortedComments = [...comments].sort(
                            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                          );
                          const displayComments = showAllComments ? sortedComments : [sortedComments[0]];

                          return (
                            <>
                              {displayComments.map((comment) => {
                                // Prefer comment.user if available, fall back to teamMembers or currentUser
                                const author = comment.user || 
                                  teamMembers.find((m) => m.id === comment.createdBy) || 
                                  (currentUser?.id === comment.createdBy ? currentUser : null);
                                
                                return (
                                  <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                                    <Avatar className="w-8 h-8">
                                      {author?.avatarUrl && (
                                        <AvatarImage src={author.avatarUrl} alt={author.name} />
                                      )}
                                      <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                                        {getInitials(author?.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm">
                                          {author?.id === currentUser?.id ? 'Вы' : (author?.name || 'Unknown')}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {formatDistanceToNow(new Date(comment.createdAt), {
                                            addSuffix: true,
                                            locale: ru,
                                          })}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {renderCommentWithMentions(comment.text)}
                                      </p>
                                      
                                      {/* Comment Attachments */}
                                      {comment.attachments && comment.attachments.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {comment.attachments.map((att) => (
                                            <a 
                                              key={att.id} 
                                              href={att.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group"
                                            >
                                              {att.type?.startsWith('image/') || att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                 <div className="relative w-10 h-10 overflow-hidden rounded bg-gray-100">
                                                   <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                 </div>
                                              ) : (
                                                 <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-gray-500">
                                                   <Paperclip className="w-5 h-5" />
                                                 </div>
                                              )}
                                              <div className="flex flex-col overflow-hidden">
                                                <span className="text-xs font-medium truncate max-w-[150px] group-hover:text-purple-600 transition-colors" title={att.name}>
                                                  {att.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                  {(att.size / 1024).toFixed(1)} KB
                                                </span>
                                              </div>
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {comments.length > 1 && !showAllComments && (
                                <Button
                                  variant="outline"
                                  onClick={() => setShowAllComments(true)}
                                  className="w-full"
                                >
                                  Показать все комментарии ({comments.length})
                                </Button>
                              )}

                              {comments.length > 1 && showAllComments && (
                                <Button
                                  variant="outline"
                                  onClick={() => setShowAllComments(false)}
                                  className="w-full"
                                >
                                  Скрыть комментарии
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <TaskHistoryTimeline 
                        history={taskHistory} 
                        projects={projects}
                        categories={categories}
                        users={teamMembers}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              )}

              <Separator />

              {/* Действия просмотра */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Закрыть
                </Button>
                {canDelete && (
                  <Button 
                    variant="outline" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить
                  </Button>
                )}
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => setMode('edit')}>
                  Редактировать
                </Button>
              </div>
            </div>
          )}

          {/* CREATE/EDIT MODE */}
          {!isViewMode && (
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
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Описание</Label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Опишите задачу подробнее"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Проект <span className="text-red-500">*</span>
                  </Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger className={errors.project ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Выберите проект" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">
                        Личные задачи
                      </SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.project && <p className="text-xs text-red-600">{errors.project}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Категория</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без категории</SelectItem>
                      {availableCategories.length === 0 && projectId !== 'personal' && (
                        <SelectItem value="disabled" disabled>
                          В проекте нет доступных категорий
                        </SelectItem>
                      )}
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${category.color}`} />
                            {category.name}
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
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-current text-orange-600" />
                          Срочный
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Статус</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectId === 'personal' ? (
                        <>
                          <SelectItem value="todo">К выполнению</SelectItem>
                          <SelectItem value="in_progress">В работе</SelectItem>
                          <SelectItem value="done">Готово</SelectItem>
                          {customColumns.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.title}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <>
                          <SelectItem value="todo">К выполнению</SelectItem>
                          <SelectItem value="in_progress">В работе</SelectItem>
                          <SelectItem value="needs_clarification">Нужно уточнение</SelectItem>
                          <SelectItem value="review">На проверке</SelectItem>
                          <SelectItem value="done">Готово</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Информация для личных задач */}
              {projectId === 'personal' && currentUser && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
                  <User className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900">
                    <p className="font-medium">Личная задача</p>
                    <p className="text-purple-700 mt-0.5">
                      Исполнитель: <span className="font-medium">{currentUser.name}</span> (вы)
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Поле исполнителя скрыто для личных задач */}
                {/* FIX Problem #2: Show assignee selector if user can edit project OR has task:assign permission */}
                {projectId !== 'personal' && (canEditProject(projectId) || hasPermission('task:assign', projectId)) && (
                  <div className="space-y-2">
                    <Label>Исполнитель</Label>
                    <Select 
                      key={`assignee-select-${projectId}-${availableMembersWithCurrent.length}-${JSON.stringify(availableMembersWithCurrent.map(m => m.id).sort())}`}
                      value={(() => {
                        // Проверяем, что выбранное значение есть в списке
                        if (!assigneeId) return 'unassigned';
                        const memberExists = availableMembersWithCurrent.some(m => m.id === assigneeId);
                        if (!memberExists) {
                          console.warn('⚠️ Выбранный assigneeId не найден в availableMembersWithCurrent:', {
                            assigneeId,
                            availableMembers: availableMembersWithCurrent.map(m => ({ id: m.id, name: m.name })),
                          });
                          return 'unassigned';
                        }
                        return assigneeId;
                      })()} 
                      onValueChange={(value) => {
                        const newValue = value === 'unassigned' ? '' : value;
                        console.log('👤 Изменение исполнителя:', {
                          oldValue: assigneeId,
                          newValue,
                          selectedMember: availableMembersWithCurrent.find(m => m.id === newValue),
                          availableMembers: availableMembersWithCurrent.map(m => ({ id: m.id, name: m.name })),
                        });
                        setAssigneeId(newValue);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите исполнителя" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          Не назначено
                        </SelectItem>
                        {availableMembersWithCurrent.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-5 h-5">
                                {member.avatarUrl && (
                                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                                )}
                                <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                              {member.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className={`space-y-2 ${projectId === 'personal' ? 'col-span-2' : ''}`}>
                  <Label>Дедлайн</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, 'PPP', { locale: ru }) : 'Выберите дату'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={dueDate} onSelect={setDueDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Теги</Label>
                <TagsInput
                  tags={tags}
                  availableTags={sortedAvailableTags}
                  onAddTag={addTag}
                  onRemoveTag={removeTag}
                  placeholder="Выберите или создайте тег"
                  maxLength={30}
                />
              </div>

              {/* Секция для повторяющихся задач */}
              <div className="space-y-3 border rounded-lg p-4 bg-purple-50/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="recurring-task"
                    checked={isRecurring}
                    onCheckedChange={(checked) => {
                      setIsRecurring(checked === true);
                      // Сбрасываем поля при отключении
                      if (!checked) {
                        setRecurringStartDate(undefined);
                        setRecurringIntervalDays(1);
                      }
                    }}
                  />
                  <Label htmlFor="recurring-task" className="cursor-pointer flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-purple-600" />
                    Повторяющаяся задача
                  </Label>
                </div>

                {isRecurring && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>Дата начала *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {recurringStartDate ? format(recurringStartDate, 'PPP', { locale: ru }) : 'Выберите дату'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={recurringStartDate} onSelect={setRecurringStartDate} />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Интервал (дней) *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={recurringIntervalDays}
                        onChange={(e) => setRecurringIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="1"
                      />
                    </div>

                    <div className="col-span-2 text-sm text-gray-600 bg-white/50 p-2 rounded border border-purple-200">
                      <p>
                        💡 Дедлайн будет автоматически установлен на:{' '}
                        <strong>
                          {recurringStartDate 
                            ? format(
                                new Date(new Date(recurringStartDate).getTime() + recurringIntervalDays * 24 * 60 * 60 * 1000),
                                'PPP',
                                { locale: ru }
                              )
                            : 'выберите дату начала'}
                        </strong>
                      </p>
                      <p className="mt-1 text-xs">
                        При завершении задача автоматически возобновится с новым дедлайном.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Файлы</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={isLoading || isUploadingFiles}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Перетащите файлы сюда или нажмите для выбора
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Поддерживаются любые типы файлов (макс. 10MB на файл)
                    </p>
                  </label>
                </div>
                
                {/* Existing attachments */}
                {!isCreateMode && existingAttachments.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-sm text-gray-600">Загруженные файлы:</p>
                    {existingAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm">{attachment.name}</p>
                            <p className="text-xs text-gray-500">
                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // FIX: Build full URL for attachment download
                              const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
                              const fullUrl = attachment.url.startsWith('http') 
                                ? attachment.url 
                                : `${API_BASE_URL}${attachment.url}`;
                              
                              // Create a temporary link element to trigger download
                              const link = document.createElement('a');
                              link.href = fullUrl;
                              link.download = attachment.name; // Set filename for download
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExistingAttachment(attachment.id)}
                            className="text-red-600 hover:text-red-700"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending files */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-sm text-gray-600">
                      {isCreateMode ? 'Файлы для загрузки:' : 'Новые файлы:'}
                    </p>
                    {pendingFiles.map((file, index) => (
                      <div
                        key={`pending-${index}`}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="text-sm">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePendingFile(index)}
                          className="text-red-600 hover:text-red-700"
                          disabled={isLoading || isUploadingFiles}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    if (isCreateMode) resetForm();
                  }}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={!title.trim() || !projectId || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isCreateMode ? 'Создание...' : 'Сохранение...'}
                    </>
                  ) : (
                    <>{isCreateMode ? 'Создать задачу' : 'Сохранить изменения'}</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить задачу
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
