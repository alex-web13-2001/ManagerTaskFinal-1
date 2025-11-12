import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ResetPasswordPageProps {
  onSuccess: () => void;
}

export function ResetPasswordPage({ onSuccess }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      const token = new URLSearchParams(window.location.search).get('reset-token');

      if (!token) {
        toast.error('Токен сброса пароля не найден');
        return;
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        toast.success('Пароль успешно изменен!');
        setTimeout(() => onSuccess(), 2000);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Ошибка при смене пароля');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Lock className="w-12 h-12 mx-auto text-purple-600 mb-4" />
          <CardTitle className="text-2xl">Смените ваш пароль</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Новый пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Минимум 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сменить пароль'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
