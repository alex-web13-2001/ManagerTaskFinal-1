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
import { Card, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import {
  Mail,
  Check,
  X,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { invitationsAPI } from '../utils/api-client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type Invitation = {
  id: string; // Database ID (used for reject/revoke operations)
  token: string; // Token used for accepting invitations
  projectId: string;
  projectName?: string;
  invitedEmail: string;
  role: string;
  status: string;
  sentDate: string;
  expiresAt: string;
};

type InvitationsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvitationAccepted?: () => void;
};

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  collaborator: 'Участник с правами',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  collaborator: 'bg-green-100 text-green-700',
  member: 'bg-gray-100 text-gray-700',
  viewer: 'bg-orange-100 text-orange-700',
};

export function InvitationsModal({
  open,
  onOpenChange,
  onInvitationAccepted,
}: InvitationsModalProps) {
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      fetchInvitations();
    }
  }, [open]);

  const fetchInvitations = async () => {
    try {
      setIsLoading(true);
      const data = await invitationsAPI.getMyInvitations();
      console.log('📩 Received invitations:', data);
      setInvitations(data);
    } catch (error) {
      console.error('Fetch invitations error:', error);
      toast.error('Ошибка загрузки приглашений');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (invitation: Invitation) => {
    try {
      setProcessingId(invitation.id);
      // Use token for accepting, not database ID
      const result = await invitationsAPI.acceptInvitation(invitation.token);
      
      toast.success('Приглашение принято! Вы теперь участник проекта.');
      
      // Remove from list using database ID
      setInvitations(invitations.filter(inv => inv.id !== invitation.id));
      
      // Notify parent to refresh projects
      if (onInvitationAccepted) {
        onInvitationAccepted();
      }
    } catch (error) {
      console.error('Accept invitation error:', error);
      toast.error(`Ошибка принятия приглашения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invitationId: string) => {
    try {
      setProcessingId(invitationId);
      await invitationsAPI.rejectInvitation(invitationId);
      
      toast.success('Приглашение отклонено');
      
      // Remove from list
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (error) {
      console.error('Reject invitation error:', error);
      toast.error('Ошибка отклонения приглашения');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: ru });
    } catch {
      return dateString;
    }
  };

  const isExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <DialogTitle>Приглашения в проекты</DialogTitle>
          </div>
          <DialogDescription>
            Вы можете принять или отклонить приглашения присоединиться к проектам
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Загрузка приглашений...
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>У вас нет новых приглашений</p>
            </div>
          ) : (
            invitations.map((invitation) => {
              const expired = isExpired(invitation.expiresAt);
              
              return (
                <Card key={invitation.id} className={expired ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            Проект: {invitation.projectName || 'Без названия'}
                          </h3>
                          {expired && (
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              Просрочено
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Роль:</span>
                            <Badge className={roleColors[invitation.role] || 'bg-gray-100 text-gray-700'}>
                              {roleLabels[invitation.role] || invitation.role}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Отправлено: {formatDate(invitation.sentDate)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Действительно до: {formatDate(invitation.expiresAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {!expired && (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAccept(invitation)}
                            disabled={processingId === invitation.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Принять
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(invitation.id)}
                            disabled={processingId === invitation.id}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Отклонить
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Separator className="my-4" />

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
