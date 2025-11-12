import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Mail, Users, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { invitationsAPI, getAuthToken } from '@/utils/api-client';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

type PageState = 'loading' | 'login-required' | 'success' | 'error';

interface InvitationData {
  token: string;
  projectId: string;
  projectName: string;
  projectColor?: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy?: {
    name: string;
    email: string;
  };
}

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

export function InvitationPage() {
  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        // Extract token from URL query parameters
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
          setErrorMessage('Токен приглашения не найден в URL');
          setState('error');
          return;
        }

        // Check if user is authenticated
        const authToken = getAuthToken();
        const isAuthenticated = !!authToken;

        // Fetch invitation details (public endpoint, no auth required)
        const response = await fetch(`${API_BASE_URL}/api/invitations/${token}`);

        if (response.status === 404) {
          setErrorMessage('Приглашение не найдено');
          setState('error');
          return;
        }

        if (response.status === 410) {
          const data = await response.json();
          setErrorMessage('Срок действия приглашения истек');
          setInvitation(data.invitation);
          setState('error');
          return;
        }

        if (response.status === 400) {
          const data = await response.json();
          if (data.error.includes('accepted')) {
            setErrorMessage('Приглашение уже было принято');
          } else {
            setErrorMessage(data.error);
          }
          setInvitation(data.invitation);
          setState('error');
          return;
        }

        if (!response.ok) {
          throw new Error('Не удалось загрузить приглашение');
        }

        const data = await response.json();
        setInvitation(data.invitation);

        // If not authenticated, show login required
        if (!isAuthenticated) {
          setState('login-required');
          // Save token for later
          sessionStorage.setItem('pendingInvitation', token);
        } else {
          // Auto-accept if authenticated
          await acceptInvitation(token);
        }
      } catch (error: any) {
        console.error('Load invitation error:', error);
        setErrorMessage(error.message || 'Ошибка загрузки приглашения');
        setState('error');
      }
    };

    loadInvitation();
  }, []);

  const acceptInvitation = async (token: string) => {
    try {
      setIsAccepting(true);
      await invitationsAPI.acceptInvitation(token);
      
      setState('success');
      toast.success('Приглашение принято! Добро пожаловать в проект.');
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      console.error('Accept invitation error:', error);
      setErrorMessage(error.message || 'Не удалось принять приглашение');
      setState('error');
      toast.error(error.message || 'Не удалось принять приглашение');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleLoginClick = () => {
    // Token already saved in sessionStorage
    window.location.href = '/?mode=signin';
  };

  const handleSignupClick = () => {
    // Token already saved in sessionStorage
    const email = invitation?.email || '';
    window.location.href = `/?mode=signup${email ? `&email=${encodeURIComponent(email)}` : ''}`;
  };

  const handleBackToHome = () => {
    window.location.href = '/';
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
            <p className="text-gray-600">Загрузка приглашения...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login required state
  if (state === 'login-required' && invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
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
                  <h3 className="text-xl font-semibold mb-2">{invitation.projectName}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-600">Ваша роль:</span>
                    <Badge className={roleColors[invitation.role] || 'bg-gray-100 text-gray-700'}>
                      {roleLabels[invitation.role] || invitation.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {roleDescriptions[invitation.role] || ''}
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
                <p className="text-sm">{invitation.email}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Действительно до</span>
                </div>
                <p className="text-sm">
                  {format(new Date(invitation.expiresAt), 'dd MMM yyyy, HH:mm', { locale: ru })}
                </p>
              </div>
            </div>

            {/* Login Warning */}
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

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleLoginClick}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Войти
              </Button>
              <Button
                onClick={handleSignupClick}
                variant="outline"
                className="flex-1"
              >
                Зарегистрироваться
              </Button>
            </div>

            {/* Info Text */}
            <p className="text-xs text-center text-gray-500 pt-4">
              После входа или регистрации приглашение будет автоматически принято
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
            <CardTitle className="text-2xl">Приглашение принято!</CardTitle>
            <CardDescription className="text-base mt-2">
              Добро пожаловать в проект {invitation?.projectName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Перенаправляем вас в панель управления...
            </p>
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-purple-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-8 h-8 text-red-600" />
            <CardTitle>Ошибка</CardTitle>
          </div>
          <CardDescription>
            {errorMessage || 'Не удалось загрузить приглашение'}
          </CardDescription>
        </CardHeader>
        {invitation && (
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Проект:</p>
              <p className="font-semibold">{invitation.projectName}</p>
            </div>
            {invitation.expiresAt && (
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {errorMessage.includes('истек') ? 'Истекло:' : 'Действительно до:'}
                </p>
                <p className="text-sm">
                  {format(new Date(invitation.expiresAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                </p>
              </div>
            )}
          </CardContent>
        )}
        <CardContent>
          <Button onClick={handleBackToHome} className="w-full">
            Вернуться на главную
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
