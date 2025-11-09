import React from 'react';
import { Plus, Search, MoreVertical, Users, Calendar, AlertCircle, Loader2, Archive, ArchiveRestore, Trash2, FolderOpen, Info, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Card, CardContent, CardHeader } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { ProjectModal } from './project-modal';
import { ProjectAboutModal } from './project-about-modal';
import { ProjectMembersModal } from './project-members-modal';
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type ProjectWithStats = {
  id: string;
  name: string;
  description: string;
  color: string;
  userRole: 'owner' | 'collaborator' | 'member' | 'viewer';
  members?: any[];
  totalTasks: number;
  overdueTasks: number;
  tasksByStatus: {
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  };
  lastUpdated: string;
  isArchived: boolean;
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

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  collaborator: 'Участник с правами',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  collaborator: 'bg-indigo-100 text-indigo-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
};

type ProjectsViewProps = {
  onProjectClick?: (projectId: string) => void;
};

export function ProjectsView({ onProjectClick }: ProjectsViewProps) {
  const { projects, tasks, isLoading, deleteProject, updateProject, archiveProject, restoreProject, currentUser } = useApp();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<string | null>(null);
  const [aboutProject, setAboutProject] = React.useState<string | null>(null);
  const [membersProject, setMembersProject] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  // Calculate project stats
  const projectsWithStats = React.useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const totalTasks = projectTasks.length;
      const overdueTasks = projectTasks.filter(
        (task) => task.deadline && new Date(task.deadline) < new Date() && !task.completed
      ).length;

      // Разбивка задач по статусам
      const tasksByStatus = {
        todo: projectTasks.filter(t => t.status === 'todo').length,
        in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
        review: projectTasks.filter(t => t.status === 'review').length,
        done: projectTasks.filter(t => t.status === 'done' || t.completed).length,
      };

      // Определяем роль текущего пользователя в проекте
      let userRole: 'owner' | 'collaborator' | 'member' | 'viewer' = 'viewer';
      
      // First check if this is an owned project (not a shared one)
      // Owner check: project.userId should match currentUser.id AND project should not be marked as shared
      const isOwner = project.userId === currentUser?.id && !(project as any).isShared;
      
      if (isOwner) {
        userRole = 'owner';
      } else if (project.members && currentUser?.id) {
        const member = project.members.find((m: any) => 
          m.userId === currentUser.id || 
          m.id === currentUser.id || 
          m.email === currentUser.email
        );
        if (member?.role) {
          userRole = member.role as 'owner' | 'collaborator' | 'member' | 'viewer';
        }
      }

      return {
        ...project,
        totalTasks,
        overdueTasks,
        tasksByStatus,
        userRole,
        isArchived: !!project.archived,
        lastUpdated: project.updatedAt
          ? format(new Date(project.updatedAt), 'PPP', { locale: ru })
          : 'Недавно',
      };
    });
  }, [projects, tasks, currentUser]);

  const filteredProjects = React.useMemo(() => {
    return projectsWithStats.filter((project) => {
      // Поиск
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!project.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Фильтр по типу
      if (typeFilter === 'mine' && project.userRole !== 'owner') return false;
      if (typeFilter === 'invited' && project.userRole === 'owner') return false;

      return true;
    });
  }, [projectsWithStats, searchQuery, typeFilter]);

  const handleProjectAction = async (projectId: string, action: string) => {
    console.log(`Action ${action} on project ${projectId}`);
    
    if (action === 'edit') {
      setEditingProject(projectId);
    } else if (action === 'archive') {
      setActionLoading(projectId);
      try {
        await archiveProject(projectId);
      } catch (error) {
        console.error('Error archiving project:', error);
      } finally {
        setActionLoading(null);
      }
    } else if (action === 'unarchive') {
      setActionLoading(projectId);
      try {
        await restoreProject(projectId);
      } catch (error) {
        console.error('Error restoring project:', error);
      } finally {
        setActionLoading(null);
      }
    }
  };



  const handleProjectClick = (projectId: string) => {
    onProjectClick?.(projectId);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Верхняя панель */}
      <div className="border-b bg-white px-4 md:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-gray-900 mb-1">Проекты</h1>
            <p className="text-gray-600 text-sm">Управление всеми вашими проектами</p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать проект
          </Button>
        </div>

        {/* Поиск и фильтры */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск по названию или владельцу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все проекты</SelectItem>
              <SelectItem value="mine">Мои</SelectItem>
              <SelectItem value="invited">Приглашённые</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Список проектов */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
            <p className="text-gray-600">Загрузка проектов...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            {searchQuery || typeFilter !== 'all' ? (
              <>
                <h3 className="text-gray-900 mb-2">Проекты не найдены</h3>
                <p className="text-gray-600 mb-4">
                  Проекты по выбранным параметрам не найдены.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setStatusFilter('active');
                  }}
                >
                  Сбросить фильтры
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-gray-900 mb-2">У вас пока нет проектов</h3>
                <p className="text-gray-600 mb-4">
                  Создайте новый проект, чтобы начать работу.
                </p>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать проект
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group relative ${
                  project.isArchived ? 'opacity-70 bg-gray-50' : ''
                } ${actionLoading === project.id ? 'pointer-events-none' : ''}`}
                onClick={() => handleProjectClick(project.id)}
              >
                {/* Индикатор загрузки */}
                {actionLoading === project.id && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                )}
                {/* Цветная полоса */}
                <div className={`h-2 ${project.isArchived ? 'bg-gray-400' : getColorClass(project.color)}`} />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate">{project.name}</h3>
                        {project.isArchived && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">
                            <Archive className="w-3 h-3 mr-1" />
                            Архив
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleProjectClick(project.id); }}>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Открыть проект
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAboutProject(project.id); }}>
                          <Info className="w-4 h-4 mr-2" />
                          О проекте
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMembersProject(project.id); }}>
                          <Users className="w-4 h-4 mr-2" />
                          Участники
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleProjectAction(project.id, 'edit'); }}
                          disabled={actionLoading === project.id}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        {project.userRole === 'owner' && (
                          <>
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleProjectAction(project.id, project.isArchived ? 'unarchive' : 'archive'); }}
                              disabled={actionLoading === project.id}
                            >
                              {project.isArchived ? (
                                <>
                                  <ArchiveRestore className="w-4 h-4 mr-2" />
                                  Восстановить
                                </>
                              ) : (
                                <>
                                  <Archive className="w-4 h-4 mr-2" />
                                  В архив
                                </>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {project.description || 'Нет описания'}
                  </p>

                  {/* Роль пользователя */}
                  <div>
                    <Badge variant="outline" className={roleColors[project.userRole]}>
                      {roleLabels[project.userRole]}
                    </Badge>
                  </div>

                  {/* Участники */}
                  {project.members && project.members.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 4).map((member: any, idx: number) => (
                          <Avatar key={idx} className="w-7 h-7 border-2 border-white">
                            <AvatarFallback className="text-xs">
                              {member.name?.split(' ').map((n: string) => n[0]).join('') || member.email?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {project.members.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                            <span className="text-xs text-gray-600">+{project.members.length - 4}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {project.members.length} {project.members.length === 1 ? 'участник' : project.members.length < 5 ? 'участника' : 'участников'}
                      </span>
                    </div>
                  )}

                  {/* Статистика задач по статусам */}
                  <div className="pt-2 border-t">
                    {project.totalTasks === 0 ? (
                      <p className="text-xs text-gray-500">Нет задач</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Первая строка: новые и в работе */}
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          {project.tasksByStatus.todo > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              <span className="text-gray-600">{project.tasksByStatus.todo} новых</span>
                            </div>
                          )}
                          {project.tasksByStatus.in_progress > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-gray-600">{project.tasksByStatus.in_progress} в работе</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Вторая строка: на проверке и завершено */}
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          {project.tasksByStatus.review > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-orange-500" />
                              <span className="text-gray-600">{project.tasksByStatus.review} на проверке</span>
                            </div>
                          )}
                          {project.tasksByStatus.done > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-gray-600">{project.tasksByStatus.done} завершено</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Просроченные задачи - отдельно */}
                        {project.overdueTasks > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-600 pt-1 border-t border-red-100">
                            <AlertCircle className="w-3 h-3" />
                            <span>{project.overdueTasks} просрочено</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования проекта */}
      <ProjectModal
        open={isCreateModalOpen || !!editingProject}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) setEditingProject(null);
        }}
        mode={editingProject ? 'edit' : 'create'}
        projectId={editingProject || undefined}
        onManageMembers={
          editingProject
            ? () => {
                setMembersProject(editingProject);
                setEditingProject(null);
              }
            : undefined
        }
      />

      {/* Модальное окно информации о проекте */}
      {aboutProject && (
        <ProjectAboutModal
          open={!!aboutProject}
          onOpenChange={(open) => !open && setAboutProject(null)}
          projectId={aboutProject}
          currentUserRole="owner"
          onEdit={() => {
            setEditingProject(aboutProject);
            setAboutProject(null);
          }}
          onManageMembers={() => {
            setMembersProject(aboutProject);
            setAboutProject(null);
          }}
        />
      )}

      {/* Модальное окно управления участниками */}
      {membersProject && (
        <ProjectMembersModal
          open={!!membersProject}
          onOpenChange={(open) => !open && setMembersProject(null)}
          projectId={membersProject}
          projectName={projects.find((p) => p.id === membersProject)?.name || ''}
          projectColor={projects.find((p) => p.id === membersProject)?.color || 'purple'}
          currentUserRole="owner"
        />
      )}
    </div>
  );
}
