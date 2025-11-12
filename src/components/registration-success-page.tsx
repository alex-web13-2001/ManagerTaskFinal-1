import { Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RegistrationSuccessPageProps {
  email: string;
}

export function RegistrationSuccessPage({ email }: RegistrationSuccessPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="w-12 h-12 mx-auto text-purple-600 mb-4" />
          <CardTitle className="text-2xl">Спасибо за регистрацию в Task Manager T24!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">
            На вашу почту <strong className="text-purple-600">{email}</strong> отправлено письмо с подтверждением.
          </p>
          <p className="text-gray-600">
            Пройдите по ссылке из письма, чтобы активировать ваш аккаунт и начать работу.
          </p>
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500">
              Не получили письмо? Проверьте папку "Спам" или повторите регистрацию.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
