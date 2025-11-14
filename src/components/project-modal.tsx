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
import { Badge } from './ui/badge';
import { X, Plus, Upload, Paperclip, Link as LinkIcon, Users, UserPlus, Loader2, Download } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { useApp, type ProjectLink, type ProjectAttachment } from '../contexts/app-context';

type ProjectModalMode = 'create' | 'edit';

type ProjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ProjectModalMode;
  projectId?: string;
  onSave?: (project: any) => void;
  onManageMembers?: () => void;
};

const colorOptions = [
  { id: 'purple', color: 'bg-purple-500', label: 'Фиолетовый' },
  { id: 'green', color: 'bg-green-500', label: 'Зелёный' },
  { id: 'blue', color: 'bg-blue-500', label: 'Синий' },
  { id: 'pink', color: 'bg-pink-500', label: 'Розовый' },
  { id: 'orange', color: 'bg-orange-500', label: 'Оранжевый' },
  { id: 'red', color: 'bg-red-500', label: 'Красный' },
  { id: 'yellow', color: 'bg-yellow-500', label: 'Жёлтый' },
  { id: 'indigo', color: 'bg-indigo-500', label: 'Индиго' },
];

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  collaborator: 'Участник с правами',
  member: 'Участник',
  viewer: 'Наблюдатель',
};


export function ProjectModal({
  open,
  onOpenChange,
  mode,
  projectId,
  onSave,
  onManageMembers,
}: ProjectModalProps) {
  const { projects, createProject, updateProject, categories, uploadProjectAttachment, deleteProjectAttachment } = useApp();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploadingFile, setIsUploadingFile] = React.useState(false);
  const prevOpenRef = React.useRef(false);
  
  const isEditMode = mode === 'edit';
  const existingProject = projectId && isEditMode ? projects.find(p => p.id === projectId) : null;

  // Form state
  const [name, setName] = React.useState(existingProject?.name || '');
  const [description, setDescription] = React.useState(existingProject?.description || '');
  const [selectedColor, setSelectedColor] = React.useState(existingProject?.color || 'purple');
  const [links, setLinks] = React.useState<ProjectLink[]>(
    existingProject?.links || []
  );
  const [newLinkName, setNewLinkName] = React.useState('');
  const [newLinkUrl, setNewLinkUrl] = React.useState('');
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [attachments, setAttachments] = React.useState<ProjectAttachment[]>(
    existingProject?.attachments || []
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    // Only run when modal opens (transitions from closed to open)
    if (open && !prevOpenRef.current) {
      if (isEditMode && projectId) {
        // Загружаем данные существующего проекта
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setName(project.name || '');
          setDescription(project.description || '');
          setSelectedColor(project.color || 'purple');
          setLinks(project.links || []);
          // Загружаем доступные категории проекта (availableCategories - массив ID)
          const projectCategories = (project as any).availableCategories || [];
          setSelectedCategories(projectCategories);
          setAttachments(project.attachments || []);
        }
      } else if (!isEditMode) {
        // Очищаем форму для создания нового проекта
        resetForm();
      }
    }
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, projectId]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedColor('purple');
    setLinks([]);
    setNewLinkName('');
    setNewLinkUrl('');
    setSelectedCategories([]);
    setAttachments([]);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Название обязательно для заполнения';
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

    setIsLoading(true);

    try {
      const projectData = {
        name,
        description,
        color: selectedColor,
        category: selectedCategories.map(catId => {
          const cat = categories.find(c => c.id === catId);
          return cat?.name || catId;
        }).join(', '), // Сохраняем для отображения
        availableCategories: selectedCategories, // Сохраняем массив ID для фильтрации в задачах
        status: isEditMode && existingProject?.status ? existingProject.status : 'active',
        links: links.length > 0 ? links : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      if (isEditMode && existingProject) {
        await updateProject(existingProject.id, projectData);
        onSave?.(projectData);
      } else {
        await createProject(projectData);
        onSave?.(projectData);
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Project save error:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения проекта');
    } finally {
      setIsLoading(false);
    }
  };

  const addLink = () => {
    if (newLinkName.trim() && newLinkUrl.trim()) {
      setLinks([
        ...links,
        {
          id: `link-${Date.now()}`,
          name: newLinkName.trim(),
          url: newLinkUrl.trim(),
        },
      ]);
      setNewLinkName('');
      setNewLinkUrl('');
    }
  };

  const removeLink = (linkId: string) => {
    setLinks(links.filter((link) => link.id !== linkId));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !projectId || !isEditMode) return;

    setIsUploadingFile(true);
    try {
      // Upload files one by one
      for (const file of Array.from(files)) {
        const attachment = await uploadProjectAttachment(projectId, file);
        setAttachments(prev => [...prev, attachment]);
      }
      toast.success('Файлы загружены успешно');
    } catch (error: any) {
      console.error('File upload error:', error);
      toast.error(error.message || 'Ошибка загрузки файлов');
    } finally {
      setIsUploadingFile(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!projectId || !isEditMode) {
      // If not editing or no project ID, just remove from local state
      setAttachments(attachments.filter((a) => a.id !== attachmentId));
      return;
    }

    try {
      await deleteProjectAttachment(projectId, attachmentId);
      setAttachments(attachments.filter((a) => a.id !== attachmentId));
    } catch (error: any) {
      console.error('Delete attachment error:', error);
      toast.error(error.message || 'Ошибка удаления файла');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Редактировать проект' : 'Создать новый проект'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Обновите информацию о проекте'
              : 'Заполните информацию о новом проекте. После создания автоматически создадутся три колонки: Assigned, In Progress, Done.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Название */}
          <div className="space-y-2">
            <Label htmlFor="project-name">
              Название проекта <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Введите название проекта"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="project-description">Описание</Label>
            <Textarea
              id="project-description"
              placeholder="Опишите проект подробнее"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Цвет */}
          <div className="space-y-2">
            <Label>Цвет проекта</Label>
            <div className="grid grid-cols-4 gap-3">
              {colorOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedColor(option.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedColor === option.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full ${option.color}`} />
                  <span className="text-sm">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Внешние ссылки */}
          <div className="space-y-2">
            <Label>Внешние ссылки</Label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Название ссылки"
                  value={newLinkName}
                  onChange={(e) => setNewLinkName(e.target.value)}
                />
                <Input
                  placeholder="URL"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addLink}
                disabled={!newLinkName.trim() || !newLinkUrl.trim()}
                className="w-full"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить ссылку
              </Button>
            </div>

            {links.length > 0 && (
              <div className="space-y-2 mt-3">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={link.name}>{link.name}</p>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 truncate block"
                          title={link.url}
                        >
                          {link.url}
                        </a>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(link.id)}
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Категории */}
          <div className="space-y-2">
            <Label>Категории проекта</Label>
            <p className="text-xs text-gray-500">Выберите категории, которые будут доступны для задач в этом проекте</p>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                У вас пока нет категорий. Создайте их в разделе &quot;Категории&quot;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategories.includes(category.id) ? 'default' : 'outline'}
                    className={`cursor-pointer ${
                      selectedCategories.includes(category.id)
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className={`w-2 h-2 rounded-full ${category.color} mr-2`} />
                    {category.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Файлы */}
          <div className="space-y-2">
            <Label>Файлы</Label>
            {isEditMode && projectId ? (
              <>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="project-file-upload"
                    disabled={isUploadingFile}
                  />
                  <label htmlFor="project-file-upload" className="cursor-pointer">
                    {isUploadingFile ? (
                      <>
                        <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                        <p className="text-sm text-gray-600">Загрузка файлов...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Перетащите файлы сюда или нажмите для выбора
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Документы, изображения, архивы</p>
                      </>
                    )}
                  </label>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                Загрузка файлов доступна после создания проекта
              </p>
            )}
            {attachments.length > 0 && (
              <div className="space-y-2 mt-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0 max-w-[400px]">
                      <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm truncate whitespace-nowrap overflow-hidden text-ellipsis">{attachment.name}</p>
                        <p className="text-xs text-gray-500">{attachment.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (attachment.url) {
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
                          }
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(attachment.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isEditMode && existingProject?.members && (
            <>
              <Separator />

              {/* Участники проекта */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Участники проекта</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      {existingProject.members.length} участник(ов)
                    </p>
                  </div>
                  {onManageMembers && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onManageMembers();
                        onOpenChange(false);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Управление участниками
                    </Button>
                  )}
                </div>

                {/* Компактный список участников */}
                <div className="space-y-2">
                  {existingProject.members.slice(0, 3).map((member) => {
                    // Handle nested user structure from server
                    const memberData = member.user || member;
                    const memberName = memberData.name || member.name || 'Без имени';
                    const memberEmail = memberData.email || member.email || '';
                    const memberAvatar = memberData.avatarUrl || member.avatarUrl;
                    const memberRole = member.role || 'member';
                    
                    // Generate initials
                    const initials = memberName
                      .split(' ')
                      .slice(0, 2)
                      .map(n => n[0])
                      .join('')
                      .toUpperCase() || memberEmail[0]?.toUpperCase() || '?';
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <Avatar className="w-8 h-8">
                          {memberAvatar && (
                            <AvatarImage src={memberAvatar} alt={memberName} />
                          )}
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-600">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{memberName}</p>
                          <p className="text-xs text-gray-500">{roleLabels[memberRole] || 'Участник'}</p>
                        </div>
                      </div>
                    );
                  })}
                  {existingProject.members.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      и ещё {existingProject.members.length - 3} участник(ов)
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                if (!isEditMode) resetForm();
              }}
              className="flex-1"
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? 'Сохранение...' : 'Создание...'}
                </>
              ) : (
                <>{isEditMode ? 'Сохранить изменения' : 'Создать проект'}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
