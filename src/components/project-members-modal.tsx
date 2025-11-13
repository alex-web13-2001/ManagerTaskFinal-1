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
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken, authAPI, projectsAPI } from '../utils/api-client';
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
  status?: 'active' | 'invited';
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

const memberStatusLabels: Record<NonNullable<Member['status']>, string> = {
  active: 'Активный',
  invited: 'Приглашён',
};

const memberStatusColors: Record<NonNullable<Member['status']>, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-blue-100 text-blue-700',
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

/**
 * Safely generate avatar initials from name or email
 * Handles null/undefined/non-string values
 */
function getAvatarSafely(name: unknown, email: unknown): string {
  // Try to use name first
  if (name && typeof name === 'string' && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length > 0) {
      return parts
        .slice(0, 2)  // Take first 2 words
        .map(p => p[0].toUpperCase())
        .join('');
    }
  }
  
  // Fallback to email
  if (email && typeof email === 'string' && email.trim()) {
    return email[0].toUpperCase();
  }
  
  // Last resort
  return '?';
}

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
  const [currentUserEmail, setCurrentUserEmail] = React.useState<string>('');

  const isOwner = currentUserRole === 'owner';
  const canManage = isOwner;

  // Fetch current user email
  React.useEffect(() => {
    const fetchCurrentUserEmail = async () => {
      try {
        const user = await authAPI.getCurrentUser();
        if (user && user.email) {
          setCurrentUserEmail(user.email.toLowerCase());
        }
      } catch (error) {
        console.error('Failed to fetch current user email:', error);
      }
    };
    
    if (open) {
      fetchCurrentUserEmail();
    }
  }, [open]);

  // Fetch members and invitations - no more polling, WebSocket will handle updates
  React.useEffect(() => {
    if (open) {
      fetchMembers();
      fetchInvitations();
    }
  }, [open, prjId]);

  const fetchMembers = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        console.log('No access token available');
        setMembers([]);
        return;
      }
      
      // FIX: Use proper API to fetch members from database instead of KV store
      // This ensures we get real-time data including accepted invitations
      const projectMembers = await projectsAPI.getProjectMembers(prjId);
      
      console.log('[ProjectMembersModal] Fetched members from API:', projectMembers);
      
      // Transform members to match expected format with validation
      const transformedMembers = projectMembers
        .filter((m: any) => {
          // Remove invalid entries
          if (!m.id && !m.userId) {
            console.warn('Member without ID:', m);
            return false;
          }
          return true;
        })
        .map((m: any) => {
          // Handle both flat and nested user structures
          const safeName = (typeof m.name === 'string' && m.name.trim()) 
            ? m.name.trim() 
            : (typeof m.user?.name === 'string' && m.user.name.trim())
              ? m.user.name.trim()
              : '';
          const safeEmail = (typeof m.email === 'string' && m.email.trim()) 
            ? m.email.trim() 
            : (typeof m.user?.email === 'string' && m.user.email.trim())
              ? m.user.email.trim()
              : '';
          
          return {
            id: m.id || m.userId,
            name: safeName || safeEmail || 'Без имени',
            email: safeEmail,
            avatar: getAvatarSafely(safeName, safeEmail),
            role: m.role,
            status: 'active', // Members from ProjectMember table are active
            addedDate: m.addedAt 
              ? new Date(m.addedAt).toLocaleDateString('ru-RU') 
              : 'Недавно',
          };
        });
      
      console.log('[ProjectMembersModal] Transformed members:', transformedMembers);
      setMembers(transformedMembers);
    } catch (error) {
      console.error('Fetch members error:', error);
      setMembers([]);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const fetchInvitations = async () => {
    try {
      const accessToken = await getAuthToken();
      
      if (!accessToken) {
        console.log('No access token available for fetching invitations');
        return;
      }
      
      // FIX: Use proper API to fetch invitations from database instead of KV store
      // This ensures we get real-time invitation data with current statuses
      const rawInvitations = await projectsAPI.getProjectInvitations(prjId);
      
      console.log('[ProjectMembersModal] Fetched invitations from API:', rawInvitations);
      
      // Transform invitations to match expected structure
      const transformedInvitations = rawInvitations.map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        sentDate: inv.createdAt ? formatDate(inv.createdAt) : 'Недавно',
        link: inv.inviteLink,
      }));
      
      console.log('[ProjectMembersModal] Transformed invitations:', transformedInvitations);
      setInvitations(transformedInvitations);
    } catch (error) {
      console.error('Fetch invitations error:', error);
    }
  };

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.email && m.email.toLowerCase().includes(query))
    );
  }, [members, searchQuery]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Введите email');
      return;
    }

    // Improved email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Введите корректный email адрес');
      return;
    }

    // Проверка на самоприглашение
    if (currentUserEmail && inviteEmail.toLowerCase() === currentUserEmail) {
      toast.error('Нельзя пригласить самого себя');
      return;
    }

    // Проверка на уже существующего участника
    if (members.some((m) => m.email && m.email.toLowerCase() === inviteEmail.toLowerCase())) {
      toast.error('Пользователь уже является участником проекта');
      return;
    }

    // Проверка на дубликат приглашения
    const existingInvite = invitations.find(
      (inv) => inv.email && inv.email.toLowerCase() === inviteEmail.toLowerCase() && inv.status === 'pending'
    );

    if (existingInvite) {
      toast.error('Приглашение уже отправлено на этот email');
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('Sending invitation for:', inviteEmail, 'role:', inviteRole);
      
      // Send invitation using new API
      const invitation = await projectsAPI.sendInvitation(prjId, inviteEmail, inviteRole);
      
      console.log('Invitation created:', invitation);
      
      // Clear input fields first
      setInviteEmail('');
      setInviteRole('member');
      
      // FIX Problem #2: Refresh both invitation list AND members to show new invited member
      await Promise.all([
        fetchInvitations(),
        fetchMembers(false), // Silent refresh to update member list with invited status
      ]);
      
      toast.success('Приглашение успешно отправлено');
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
      
      // FIX: Use proper API to resend invitation instead of KV store
      await projectsAPI.resendInvitation(invitation.id);
      
      // Refresh invitations list
      await fetchInvitations();
      toast.success('Приглашение повторно отправлено');
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
      
      // Revoke invitation using new API
      await projectsAPI.revokeInvitation(prjId, inviteToRevoke.id);
      
      // Refresh invitations
      await fetchInvitations();
      toast.success('Приглашение отозвано');
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
      
      // Update role using new API
      await projectsAPI.updateMemberRole(prjId, memberId, newRole);
      
      // FIX Problem #2: Refresh members from server instead of just updating local state
      await fetchMembers(false);
      
      toast.success('Роль обновлена');
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
      
      // Remove member using new API
      await projectsAPI.removeMember(prjId, memberToDelete.id);
      
      // FIX Problem #2: Refresh members from server
      await fetchMembers(false);
      
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
        <DialogContent className="w-full sm:max-w-[800px] mx-auto my-4 sm:my-8 max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
                        <p className="truncate">{member.name || 'Без имени'}</p>
                        <p className="text-sm text-gray-500 truncate">{member.email || 'Нет email'}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right min-w-[200px]">
                          {canManage && member.role !== 'owner' && member.status !== 'invited' ? (
                            <>
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  handleChangeRole(member.id, value as Role)
                                }
                                disabled={member.status === 'invited'}
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
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500">
                                  Добавлен {member.addedDate}
                                </p>
                                {member.status && (
                                  <Badge variant="outline" className={`text-xs ${memberStatusColors[member.status]}`}>
                                    {memberStatusLabels[member.status]}
                                  </Badge>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="bg-purple-100 text-purple-700">
                                  {roleLabels[member.role]}
                                </Badge>
                                {member.status && (
                                  <Badge variant="outline" className={`text-xs ${memberStatusColors[member.status]}`}>
                                    {memberStatusLabels[member.status]}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Добавлен {member.addedDate}
                              </p>
                            </>
                          )}
                        </div>

                        {canManage && member.role !== 'owner' && member.status !== 'invited' && (
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
                      <Button 
                        type="button"
                        onClick={handleInvite} 
                        disabled={isLoading}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Отправка...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Пригласить
                          </>
                        )}
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
                            type="button"
                            onClick={handleInvite}
                            disabled={isLoading}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Отправка...
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Пригласить
                              </>
                            )}
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
                        <p className="truncate">{invitation.email || 'Нет email'}</p>
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
                      <Button 
                        type="button"
                        onClick={handleInvite} 
                        disabled={isLoading}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Отправка...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Пригласить
                          </>
                        )}
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
