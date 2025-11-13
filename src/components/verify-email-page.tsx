import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VerifyEmailPageProps {
  onVerified: (hasInvitation: boolean) => void;
}

export function VerifyEmailPage({ onVerified }: VerifyEmailPageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = new URLSearchParams(window.location.search).get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Токен активации не найден');
        return;
      }

      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();
        
        if (res.ok) {
          localStorage.setItem('auth_token', data.token);
          setStatus('success');
          setMessage('Email успешно подтвержден!');
          
          // FIX Problem #3: Clear token from URL to prevent auth errors on page refresh
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Проверяем, есть ли отложенное приглашение
          const pendingToken = sessionStorage.getItem('pendingInvitation');
          
          if (pendingToken) {
            // Принимаем приглашение
            try {
              await fetch(`/api/invitations/${pendingToken}/accept`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${data.token}`
                }
              });
              sessionStorage.removeItem('pendingInvitation');
              setTimeout(() => onVerified(true), 2000);
            } catch (error) {
              console.error('Ошибка принятия приглашения:', error);
              setTimeout(() => onVerified(false), 2000);
            }
          } else {
            // Показываем приветственное модальное окно
            setTimeout(() => onVerified(false), 2000);
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Ошибка активации аккаунта');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Ошибка соединения с сервером');
      }
    };

    verifyEmail();
  }, [onVerified]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && <Loader2 className="w-12 h-12 mx-auto text-purple-600 animate-spin mb-4" />}
          {status === 'success' && <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />}
          {status === 'error' && <XCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />}
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Активация аккаунта...'}
            {status === 'success' && 'Аккаунт активирован!'}
            {status === 'error' && 'Ошибка активации'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className={`text-lg ${status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
            {message}
          </p>
          {status === 'success' && (
            <p className="text-sm text-gray-500 mt-4">
              Перенаправляем вас на дашборд...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
