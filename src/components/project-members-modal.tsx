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
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
import {
  Users,
  Mail,
  Trash2,
  Copy,
  Send,
  X,
  Search,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getAuthToken } from '../utils/supabase/client';
import { projectsAPI } from '../utils/api-client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type Role = 'owner' | 'collaborator' | 'member' | 'viewer';

type Member = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  addedDate: string;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'expired' | 'revoked' | 'accepted';
  sentDate: string;
  link?: string;
};

type ProjectMembersModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectColor: string;
  currentUserRole: Role;
};

const roleLabels: Record<Role, string> = {
  owner: 'Владелец',
  collaborator: 'Участник с правами',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

const roleDescriptions: Record<Role, string> = {
  owner: 'Полный доступ ко всем функциям',
  collaborator: 'Может приглашать и видеть всех участников',
  member: 'Может менять статусы своих задач',
  viewer: 'Только просмотр',
};

const statusLabels: Record<Invitation['status'], string> = {
  pending: 'Ожидает',
  expired: 'Просрочено',
  revoked: 'Отозвано',
  accepted: 'Принято',
};

const statusColors: Record<Invitation['status'], string> = {
  pending: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-700',
  accepted: 'bg-green-100 text-green-700',
};

// Helper function to format dates
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'dd.MM.yyyy', { locale: ru });
  } catch {
    return dateString; // Return original if parsing fails
  }
};

// Mock data
const getMockMembers = (): Member[] => [
  {
    id: '1',
    name: 'Мария Иванова',
    email: 'maria@example.com',
    avatar: 'МИ',
    role: 'owner',
    addedDate: '15.10.2024',
  },
  {
    id: '2',
    name: 'Александр Петров',
    email: 'alex@example.com',
    avatar: 'АП',
    role: 'collaborator',
    addedDate: '20.10.2024',
  },
  {
    id: '3',
    name: 'Евгений Смирнов',
    email: 'evgeny@example.com',
    avatar: 'ЕС',
    role: 'member',
    addedDate: '22.10.2024',
  },
  {
    id: '4',
    name: 'Дмитрий Козлов',
    email: 'dmitry@example.com',
    avatar: 'ДК',
    role: 'viewer',
    addedDate: '25.10.2024',
  },
];

const getMockInvitations = (): Invitation[] => [
  {
    id: '1',
    email: 'anna@example.com',
    role: 'member',
    status: 'pending',
    sentDate: '28.10.2024',
    link: 'https://t24.app/invite/abc123',
  },
  {
    id: '2',
    email: 'igor@example.com',
    role: 'viewer',
    status: 'expired',
    sentDate: '20.10.2024',
  },
];

export function ProjectMembersModal({
  open,
  onOpenChange,
  projectId: prjId,
  projectName,
  projectColor,
  currentUserRole,
}: ProjectMembersModalProps) {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<Role>('member');
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = React.useState<Invitation | null>(null);
  const [activeTab, setActiveTab] = React.useState('members');
  const [isLoading, setIsLoading] = React.useState(false);

  const isOwner = currentUserRole === 'owner';
  const canManage = isOwner;

  // Fetch members and invitations
  React.useEffect(() => {
    if (open) {
      fetchMembers();
      fetchInvitations();
    }
  }, [open, prjId]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        console.log('No access token available');
        setMembers([]);
        return;
      }
      
      // Fetch projects from KV store
      const projects = await projectsAPI.getAll();
      const project = projects.find((p: any) => p.id === prjId);
      
      if (!project) {
        console.error('Project not found');
        setMembers([]);
        return;
      }
      
      // Transform members to match expected format
      const transformedMembers = (project.members || []).map((m: any) => ({
        id: m.id || m.userId,
        name: m.name || m.email,
        email: m.email,
        avatar: m.name ? m.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : m.email?.[0]?.toUpperCase() || '?',
        role: m.role,
        addedDate: m.addedDate ? new Date(m.addedDate).toLocaleDateString('ru-RU') : 'Недавно',
      }));
      
      setMembers(transformedMembers);
    } catch (error) {
      console.error('Fetch members error:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        console.log('No access token available for fetching invitations');
        return;
      }
      
      // Fetch projects from KV store
      const projects = await projectsAPI.getAll();
      const project = projects.find((p: any) => p.id === prjId);
      
      if (!project) {
        console.error('Project not found');
        return;
      }
      
      // Get invitations from project
      setInvitations(project.invitations || []);
    } catch (error) {
      console.error('Fetch invitations error:', error);
    }
  };

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Введите email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Введите корректный email адрес');
      return;
    }

    // Проверка на уже существующего участника
    if (members.some((m) => m.email === inviteEmail)) {
      toast.error('Пользователь уже является участником проекта');
      return;
    }

    // Проверка на дубликат приглашения
    const existingInvite = invitations.find(
      (inv) => inv.email === inviteEmail && inv.status === 'pending'
    );

    if (existingInvite) {
      toast.error('Приглашение уже отправлено на этот email');
      return;
    }

    try {
      setIsLoading(true);
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        console.error('No access token found');
        toast.error('Необходима авторизация. Пожалуйста, войдите в систему заново.');
        return;
      }

      console.log('Sending invitation for:', inviteEmail, 'role:', inviteRole);
      
      // Fetch current projects
      const projects = await projectsAPI.getAll();
      const projectIndex = projects.findIndex((p: any) => p.id === prjId);
      
      if (projectIndex === -1) {
        toast.error('Проект не найден');
        return;
      }
      
      const project = projects[projectIndex];
      
      // Create new invitation
      const newInvitation: Invitation = {
        id: `inv-${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        status: 'pending',
        sentDate: new Date().toISOString(),
        link: `${window.location.origin}/invite/${prjId}/${Date.now()}`,
      };
      
      // Update project with new invitation
      project.invitations = [...(project.invitations || []), newInvitation];
      projects[projectIndex] = project;
      
      // Save to KV store
      await projectsAPI.update(prjId, { invitations: project.invitations });
      
      console.log('Invitation created:', newInvitation);
      setInvitations([newInvitation, ...invitations]);
      setInviteEmail('');
      setInviteRole('member');
      toast.success('Приглашение отправлено');
      setActiveTab('invitations');
    } catch (error) {
      console.error('Invite error (catch block):', error);
      toast.error(`Ошибка отправки приглашения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (link?: string) => {
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована в буфер обмена');
    }
  };

  const handleResendInvite = async (invitation: Invitation) => {
    try {
      setIsLoading(true);
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        toast.error('Необходима авторизация');
        return;
      }
      
      // Fetch current projects
      const projects = await projectsAPI.getAll();
      const project = projects.find((p: any) => p.id === prjId);
      
      if (!project) {
        toast.error('Проект не найден');
        return;
      }
      
      // Update invitation sent date
      const invitations = project.invitations || [];
      const inviteIndex = invitations.findIndex((inv: Invitation) => inv.id === invitation.id);
      
      if (inviteIndex !== -1) {
        invitations[inviteIndex].sentDate = new Date().toISOString();
        invitations[inviteIndex].status = 'pending';
        await projectsAPI.update(prjId, { invitations });
        await fetchInvitations();
        toast.success('Приглашение повторно отправлено');
      } else {
        toast.error('Приглашение не найдено');
      }
    } catch (error) {
      console.error('Resend invite error:', error);
      toast.error('Ошибка повторной отправки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!inviteToRevoke) return;

    try {
      setIsLoading(true);
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        toast.error('Необходима авторизация');
        setInviteToRevoke(null);
        return;
      }
      
      // Fetch current projects
      const projects = await projectsAPI.getAll();
      const project = projects.find((p: any) => p.id === prjId);
      
      if (!project) {
        toast.error('Проект не найден');
        setInviteToRevoke(null);
        return;
      }
      
      // Update invitation status
      const invitations = project.invitations || [];
      const inviteIndex = invitations.findIndex((inv: Invitation) => inv.id === inviteToRevoke.id);
      
      if (inviteIndex !== -1) {
        invitations[inviteIndex].status = 'revoked';
        await projectsAPI.update(prjId, { invitations });
        await fetchInvitations();
        toast.success('Приглашение отозвано');
      } else {
        toast.error('Приглашение не найдено');
      }
    } catch (error) {
      console.error('Revoke invite error:', error);
      toast.error('Ошибка отзыва приглашения');
    } finally {
      setIsLoading(false);
      setInviteToRevoke(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: Role) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Проверка: нельзя снять последнего владельца
    if (member.role === 'owner' && newRole !== 'owner') {
      const ownerCount = members.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        toast.error('Нельзя снять последнего владельца проекта');
        return;
      }
    }

    try {
      setIsLoading(true);
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        toast.error('Необходима авторизация');
        return;
      }
      
      // Fetch current projects
      const projects = await projectsAPI.getAll();
      const project = projects.find((p: any) => p.id === prjId);
      
      if (!project) {
        toast.error('Проект не найден');
        return;
      }
      
      // Update member role
      const projectMembers = project.members || [];
      const memberIndex = projectMembers.findIndex((m: any) => (m.id || m.userId) === memberId);
      
      if (memberIndex !== -1) {
        projectMembers[memberIndex].role = newRole;
        await projectsAPI.update(prjId, { members: projectMembers });
        
        setMembers(
          members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        toast.success('Роль обновлена');
      } else {
        toast.error('Участник не найден');
      }
    } catch (error) {
      console.error('Change role error:', error);
      toast.error('Ошибка обновления роли');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    // Проверка: нельзя удалить последнего владельца
    if (memberToDelete.role === 'owner') {
      const ownerCount = members.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        toast.error('Нельзя удалить последнего владельца проекта');
        setMemberToDelete(null);
        return;
      }
    }

    try {
      setIsLoading(true);
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        toast.error('Необходима авторизация');
        setMemberToDelete(null);
        return;
      }
      
      // Fetch current projects
      const projects = await projectsAPI.getAll();
      const project = projects.find((p: any) => p.id === prjId);
      
      if (!project) {
        toast.error('Проект не найден');
        setMemberToDelete(null);
        return;
      }
      
      // Remove member
      const projectMembers = project.members || [];
      const updatedMembers = projectMembers.filter((m: any) => (m.id || m.userId) !== memberToDelete.id);
      
      await projectsAPI.update(prjId, { members: updatedMembers });
      setMembers(members.filter((m) => m.id !== memberToDelete.id));
      toast.success('Участник удалён из проекта');
    } catch (error) {
      console.error('Delete member error:', error);
      toast.error('Ошибка удаления участника');
    } finally {
      setIsLoading(false);
      setMemberToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>Участники проекта</DialogTitle>
              <Badge className={`${projectColor} text-white`}>{projectName}</Badge>
            </div>
            <DialogDescription>
              Управление участниками и приглашениями проекта
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">
                <Users className="w-4 h-4 mr-2" />
                Участники ({members.length})
              </TabsTrigger>
              <TabsTrigger value="invitations">
                <Mail className="w-4 h-4 mr-2" />
                Приглашения ({invitations.filter((i) => i.status === 'pending').length})
              </TabsTrigger>
            </TabsList>

            {/* Вкладка "Участники" */}
            <TabsContent value="members" className="space-y-4 mt-4">
              {/* Поиск */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Поиск по имени или email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Список участников */}
              <div className="space-y-2">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Участники не найдены</p>
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          {member.avatar}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="truncate">{member.name}</p>
                        <p className="text-sm text-gray-500 truncate">{member.email}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right min-w-[200px]">
                          {canManage && member.role !== 'owner' ? (
                            <>
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  handleChangeRole(member.id, value as Role)
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="collaborator">
                                    {roleLabels.collaborator}
                                  </SelectItem>
                                  <SelectItem value="member">
                                    {roleLabels.member}
                                  </SelectItem>
                                  <SelectItem value="viewer">
                                    {roleLabels.viewer}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-500 mt-1">
                                {roleDescriptions[member.role]}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Добавлен {member.addedDate}
                              </p>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="bg-purple-100 text-purple-700">
                                {roleLabels[member.role]}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                Добавлен {member.addedDate}
                              </p>
                            </>
                          )}
                        </div>

                        {canManage && member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMemberToDelete(member)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Форма приглашения */}
              {canManage && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Пригласить нового участника</Label>
                    <div className="flex gap-3">
                      <Input
                        type="email"
                        placeholder="Email участника"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                        <SelectTrigger className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="collaborator">
                            {roleLabels.collaborator}
                          </SelectItem>
                          <SelectItem value="member">{roleLabels.member}</SelectItem>
                          <SelectItem value="viewer">{roleLabels.viewer}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleInvite} className="bg-purple-600 hover:bg-purple-700">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Пригласить
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Вкладка "Приглашения" */}
            <TabsContent value="invitations" className="space-y-4 mt-4">
              {invitations.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-4">Ожидающих приглашений нет</p>
                  {canManage && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <Label>Пригласить по email</Label>
                        <div className="flex gap-3">
                          <Input
                            type="email"
                            placeholder="Email участника"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="flex-1"
                          />
                          <Select
                            value={inviteRole}
                            onValueChange={(v) => setInviteRole(v as Role)}
                          >
                            <SelectTrigger className="w-52">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="collaborator">
                                {roleLabels.collaborator}
                              </SelectItem>
                              <SelectItem value="member">{roleLabels.member}</SelectItem>
                              <SelectItem value="viewer">{roleLabels.viewer}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleInvite}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            Пригласить
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <Mail className="w-8 h-8 text-gray-400" />

                      <div className="flex-1 min-w-0">
                        <p className="truncate">{invitation.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {roleLabels[invitation.role]}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${statusColors[invitation.status]}`}>
                            {statusLabels[invitation.status]}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          Отправлено {invitation.sentDate}
                        </p>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-2">
                          {invitation.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyLink(invitation.link)}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Скопировать
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInviteToRevoke(invitation)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Отозвать
                              </Button>
                            </>
                          )}
                          {invitation.status === 'expired' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvite(invitation)}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Отправить снова
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Форма приглашения внизу */}
              {canManage && invitations.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Отправить новое приглашение</Label>
                    <div className="flex gap-3">
                      <Input
                        type="email"
                        placeholder="Email участника"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                        <SelectTrigger className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="collaborator">
                            {roleLabels.collaborator}
                          </SelectItem>
                          <SelectItem value="member">{roleLabels.member}</SelectItem>
                          <SelectItem value="viewer">{roleLabels.viewer}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleInvite} className="bg-purple-600 hover:bg-purple-700">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Пригласить
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <Separator className="mt-4" />

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления участника */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить участника?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить доступ для {memberToDelete?.name}? Этот
              пользователь сразу потеряет доступ к проекту.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог подтверждения отзыва приглашения */}
      <AlertDialog open={!!inviteToRevoke} onOpenChange={() => setInviteToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать приглашение?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отозвать приглашение для {inviteToRevoke?.email}? Ссылка
              приглашения станет недействительной.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeInvite}
              className="bg-red-600 hover:bg-red-700"
            >
              Отозвать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
