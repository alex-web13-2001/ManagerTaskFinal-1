import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import {
  Link as LinkIcon,
  Paperclip,
  Users,
  CheckCircle2,
  AlertCircle,
  Download,
  Edit,
  Calendar,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';
import { useProjects } from '../contexts/projects-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { truncateUrl } from '../utils/truncate-url';
import { sanitizeHtml } from '../utils/sanitize-html';

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  collaborator: 'Участник с правами',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

type ProjectAboutModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onEdit?: () => void;
  onManageMembers?: () => void;
  currentUserRole?: 'owner' | 'collaborator' | 'member' | 'viewer';
};

// Helper to map color string to Tailwind class
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

export function ProjectAboutModal({
  open,
  onOpenChange,
  projectId,
  onEdit,
  onManageMembers,
  currentUserRole = 'owner',
}: ProjectAboutModalProps) {
  const { currentUser } = useAuth();
  const { tasks, fetchTasks } = useTasks();
  const { projects, canEditProject } = useProjects();
  
  const project = React.useMemo(() => 
    projects.find(p => p.id === projectId),
    [projects, projectId]
  );

  const projectTasks = React.useMemo(() => 
    tasks.filter(task => task.projectId === projectId),
    [tasks, projectId]
  );

  const stats = React.useMemo(() => {
    const totalTasks = projectTasks.length;
    const newTasks = projectTasks.filter(task => task.status === 'new').length;
    const inProgressTasks = projectTasks.filter(task => task.status === 'in_progress').length;
    const inReviewTasks = projectTasks.filter(task => task.status === 'in_review').length;
    const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
    const overdueTasks = projectTasks.filter(
      task => task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed'
    ).length;
    const activeMembers = project?.members?.length || 0;

    return { 
      totalTasks, 
      newTasks, 
      inProgressTasks, 
      inReviewTasks, 
      completedTasks, 
      overdueTasks, 
      activeMembers 
    };
  }, [projectTasks, project]);

  if (!project) {
    return null;
  }

  const isOwner = currentUserRole === 'owner' || project.userId === currentUser?.id;
  const canEdit = canEditProject(projectId);
  const categories = project.category ? project.category.split(', ').filter(Boolean) : [];
  const links = project.links || [];
  const attachments = project.attachments || [];
  const members = project.members || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full ${getColorClass(project.color)}`} />
                <DialogTitle className="text-2xl">{project.name}</DialogTitle>
              </div>
              <DialogDescription>Подробная информация о проекте</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Основная информация */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Создан</p>
                <p>{format(new Date(project.createdAt), 'PPP', { locale: ru })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Владелец</p>
                <p>{currentUser?.name || 'Вы'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Описание */}
          {project.description && (
            <>
              <div>
                <h4 className="mb-2">Описание проекта</h4>
                <div 
                  className="text-sm text-gray-600 leading-relaxed max-h-[300px] overflow-y-auto break-words prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.description) }}
                />
              </div>
              <Separator />
            </>
          )}

          {/* Внешние ссылки */}
          {links.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <LinkIcon className="w-4 h-4" />
                  <h4>Внешние ссылки ({links.length})</h4>
                </div>
                <div className="space-y-2">
                  {links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-[400px]">
                        <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm truncate whitespace-nowrap overflow-hidden text-ellipsis">{link.name}</p>
                          <p className="text-xs text-gray-500 truncate whitespace-nowrap overflow-hidden text-ellipsis" title={link.url}>{truncateUrl(link.url, 60)}</p>
                        </div>
                      </div>
                      <LinkIcon className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Категории */}
          {categories.length > 0 && (
            <>
              <div>
                <h4 className="mb-3">Категории</h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge key={category} variant="secondary" className="text-sm">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Файлы */}
          {attachments.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4" />
                  <h4>Файлы проекта ({attachments.length})</h4>
                </div>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-[400px]">
                        <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm truncate whitespace-nowrap overflow-hidden text-ellipsis">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{attachment.size}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          if (attachment.url) {
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
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Скачать
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Участники */}
          {members.length > 0 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <h4>Участники проекта ({members.length})</h4>
                  </div>
                  {canEdit && onManageMembers && (
                    <Button
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
                <div className="space-y-2">
                  {members.map((member) => {
                    // Handle nested user structure from server
                    const memberData = member.user || member;
                    const memberName = memberData.name || member.name || member.email || 'Без имени';
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
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            {memberAvatar && (
                              <AvatarImage src={memberAvatar} alt={memberName} />
                            )}
                            <AvatarFallback className="text-sm bg-purple-100 text-purple-600">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{memberName}</p>
                            <p className="text-xs text-gray-500">{roleLabels[memberRole] || roleLabels.member}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{roleLabels[memberRole] || roleLabels.member}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Статистика */}
          <div>
            <h4 className="mb-3">Статистика проекта</h4>
            
            {/* Краткая информация */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">{stats.activeMembers} {stats.activeMembers === 1 ? 'участник' : stats.activeMembers < 5 ? 'участника' : 'участников'}</span>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">{stats.totalTasks} {stats.totalTasks === 1 ? 'задача' : stats.totalTasks < 5 ? 'задачи' : 'задач'}</span>
                </div>
              </div>
            </div>

            {/* Статусы задач */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-gray-700">{stats.newTasks} новых</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-gray-700">{stats.inProgressTasks} в работе</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span className="text-gray-700">{stats.inReviewTasks} на проверке</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">{stats.completedTasks} завершено</span>
                </div>
              </div>
              
              {stats.overdueTasks > 0 && (
                <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-200">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">{stats.overdueTasks} просрочено</span>
                </div>
              )}
            </div>
          </div>

          {/* Пустое состояние для проектов без данных */}
          {!project.description && links.length === 0 && categories.length === 0 && attachments.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-2">Информация о проекте не заполнена</p>
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEdit();
                    onOpenChange(false);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Добавить информацию
                </Button>
              )}
            </div>
          )}

          <Separator />

          {/* Кнопки действий */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Закрыть
            </Button>
            {canEdit && onEdit && (
              <Button
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Редактировать проект
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
