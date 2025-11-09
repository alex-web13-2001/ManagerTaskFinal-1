import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Check, X, Mail, Calendar, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { invitationsAPI, getAuthToken } from '../utils/supabase/client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

type InvitationStatus = 'loading' | 'found' | 'expired' | 'not-found' | 'already-accepted' | 'error';

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

const roleDescriptions: Record<string, string> = {
  owner: 'Полный контроль над проектом',
  admin: 'Управление участниками и приглашениями',
  collaborator: 'Создание и редактирование задач',
  member: 'Просмотр и редактирование своих задач',
  viewer: 'Только просмотр проекта',
};

export function InviteAcceptPage() {
  const [invitationId, setInvitationId] = React.useState<string>('');
  const [status, setStatus] = React.useState<InvitationStatus>('loading');
  const [invitation, setInvitation] = React.useState<any>(null);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    // Extract invitation ID from URL
    const path = window.location.pathname;
    const id = path.replace('/invite/', '');
    setInvitationId(id);
  }, []);

  React.useEffect(() => {
    if (invitationId) {
      checkAuth();
      fetchInvitation();
    }
  }, [invitationId]);

  const checkAuth = async () => {
    const token = await getAuthToken();
    setIsAuthenticated(!!token);
  };

  const fetchInvitation = async () => {
    try {
      setStatus('loading');
      
      const response = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}`);
      
      if (response.status === 404) {
        setStatus('not-found');
        return;
      }
      
      if (response.status === 410) {
        setStatus('expired');
        const data = await response.json();
        setInvitation(data.invitation);
        return;
      }
      
      if (response.status === 400) {
        const data = await response.json();
        if (data.error.includes('accepted')) {
          setStatus('already-accepted');
          setInvitation(data.invitation);
        }
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch invitation');
      }
      
      const data = await response.json();
      setInvitation(data.invitation);
      setStatus('found');
    } catch (error) {
      console.error('Fetch invitation error:', error);
      setStatus('error');
    }
  };

  const handleAccept = async () => {
    if (!isAuthenticated) {
      toast.error('Пожалуйста, войдите в систему, чтобы принять приглашение');
      // Save invitation ID to accept after login
      sessionStorage.setItem('pendingInvitation', invitationId || '');
      window.location.href = '/';
      return;
    }

    try {
      setIsAccepting(true);
      await invitationsAPI.acceptInvitation(invitation.id);
      
      toast.success('Приглашение принято! Добро пожаловать в проект.');
      
      // Navigate to projects page
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      console.error('Accept invitation error:', error);
      toast.error(error.message || 'Не удалось принять приглашение');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!isAuthenticated) {
      toast.error('Пожалуйста, войдите в систему');
      window.location.href = '/';
      return;
    }

    try {
      setIsAccepting(true);
      await invitationsAPI.rejectInvitation(invitation.id);
      
      toast.success('Приглашение отклонено');
      window.location.href = '/';
    } catch (error: any) {
      console.error('Reject invitation error:', error);
      toast.error('Не удалось отклонить приглашение');
    } finally {
      setIsAccepting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
            <p className="text-gray-600">Загрузка приглашения...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <CardTitle>Приглашение не найдено</CardTitle>
            </div>
            <CardDescription>
              Ссылка на приглашение недействительна или была удалена.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => () => window.location.href = '/'} className="w-full">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              <CardTitle>Приглашение истекло</CardTitle>
            </div>
            <CardDescription>
              Срок действия этого приглашения истек. Попросите владельца проекта отправить новое приглашение.
            </CardDescription>
          </CardHeader>
          {invitation && (
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Проект:</p>
                <p className="font-semibold">{invitation.projectName || 'Без названия'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Истекло:</p>
                <p className="text-sm">{format(new Date(invitation.expiresAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}</p>
              </div>
              <Button onClick={() => () => window.location.href = '/'} className="w-full" variant="outline">
                Вернуться на главную
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  if (status === 'already-accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Check className="w-8 h-8 text-green-600" />
              <CardTitle>Приглашение уже принято</CardTitle>
            </div>
            <CardDescription>
              Это приглашение уже было принято ранее.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => () => window.location.href = '/'} className="w-full">
              Перейти к проектам
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <CardTitle>Ошибка</CardTitle>
            </div>
            <CardDescription>
              Не удалось загрузить приглашение. Попробуйте обновить страницу.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={fetchInvitation} className="w-full" variant="outline">
              Попробовать снова
            </Button>
            <Button onClick={() => () => window.location.href = '/'} className="w-full" variant="ghost">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Status === 'found'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Приглашение в проект</CardTitle>
          <CardDescription className="text-base mt-2">
            Вас приглашают присоединиться к проекту
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Project Info */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">{invitation?.projectName || 'Без названия'}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-600">Ваша роль:</span>
                  <Badge className={roleColors[invitation?.role] || 'bg-gray-100 text-gray-700'}>
                    {roleLabels[invitation?.role] || invitation?.role}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {roleDescriptions[invitation?.role] || ''}
                </p>
              </div>
            </div>
          </div>

          {/* Invitation Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Email</span>
              </div>
              <p className="text-sm">{invitation?.invitedEmail}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Действительно до</span>
              </div>
              <p className="text-sm">
                {invitation?.expiresAt && format(new Date(invitation.expiresAt), 'dd MMM yyyy, HH:mm', { locale: ru })}
              </p>
            </div>
          </div>

          {/* Login Warning */}
          {!isAuthenticated && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 mb-1">Требуется вход в систему</p>
                  <p className="text-sm text-yellow-800">
                    Чтобы принять приглашение, необходимо войти в систему или зарегистрироваться.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleReject}
              variant="outline"
              className="flex-1"
              disabled={isAccepting}
            >
              <X className="w-4 h-4 mr-2" />
              Отклонить
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Принятие...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Принять приглашение
                </>
              )}
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-xs text-center text-gray-500 pt-4">
            После принятия приглашения вы сможете сразу начать работу над проектом в соответствии с вашими правами доступа.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
