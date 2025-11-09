import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { authAPI } from '../utils/supabase/client';
import { AnimatedLogo } from './logo';

export function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [registerName, setRegisterName] = React.useState('');
  const [registerEmail, setRegisterEmail] = React.useState('');
  const [registerPassword, setRegisterPassword] = React.useState('');
  const [resetEmail, setResetEmail] = React.useState('');
  const [showResetPassword, setShowResetPassword] = React.useState(false);
  const [resetEmailSent, setResetEmailSent] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Заполните все поля');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await authAPI.signIn(loginEmail, loginPassword);
      toast.success('Вход выполнен успешно! 🎉');
      onLogin();
    } catch (error: any) {
      // Don't log expected auth errors (like wrong password)
      toast.error(error.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      toast.error('Заполните все поля');
      return;
    }
    
    if (registerPassword.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await authAPI.signUp(registerEmail, registerPassword, registerName);
      toast.success('🎉 Регистрация успешна! Загружаем ваше рабочее пространство...');
      // Small delay to show the success message
      setTimeout(() => {
        onLogin();
      }, 500);
    } catch (error: any) {
      console.error('Register error:', error);
      toast.error(error.message || 'Ошибка регистрации');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await authAPI.resetPassword(resetEmail);
      setResetEmailSent(true);
      toast.success('Письмо с инструкциями отправлено на ' + resetEmail);
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error.message || 'Ошибка отправки письма');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <AnimatedLogo />
          <p className="text-gray-600 mt-4 text-center">Управление задачами и проектами</p>
        </div>

        <Card>
          <CardHeader>
            {showResetPassword && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetEmailSent(false);
                  setResetEmail('');
                }}
                className="w-fit mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад к входу
              </Button>
            )}
            <CardTitle>{showResetPassword ? 'Восстановление пароля' : 'Добро пожаловать'}</CardTitle>
            <CardDescription>
              {showResetPassword
                ? 'Введите email для получения инструкций'
                : 'Войдите в свой аккаунт или создайте новый'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showResetPassword ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="register">Регистрация</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Пароль</Label>
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(true)}
                          className="text-sm text-purple-600 hover:text-purple-700 hover:underline"
                        >
                          Забыли пароль?
                        </button>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Вход...
                        </>
                      ) : (
                        'Войти'
                      )}
                    </Button>
                    <p className="text-center text-sm text-gray-600 mt-4">
                      Нет аккаунта?{' '}
                      <button
                        type="button"
                        onClick={() => setActiveTab('register')}
                        className="text-purple-600 hover:text-purple-700 hover:underline"
                      >
                        Зарегистрируйтесь
                      </button>
                    </p>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Имя</Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Ваше имя"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Пароль</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-gray-500">Минимум 8 символов</p>
                    </div>
                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Регистрация...
                        </>
                      ) : (
                        'Зарегистрироваться'
                      )}
                    </Button>
                    <p className="text-center text-sm text-gray-600 mt-4">
                      Уже есть аккаунт?{' '}
                      <button
                        type="button"
                        onClick={() => setActiveTab('login')}
                        className="text-purple-600 hover:text-purple-700 hover:underline"
                      >
                        Войти
                      </button>
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="mt-4">
                {!resetEmailSent ? (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                      />
                      <p className="text-sm text-gray-500">
                        Мы отправим инструкции по восстановлению пароля на указанный email
                      </p>
                    </div>
                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Отправка...
                        </>
                      ) : (
                        'Отправить инструкции'
                      )}
                    </Button>
                  </form>
                ) : (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Письмо с инструкциями по восстановлению пароля отправлено на{' '}
                      <strong>{resetEmail}</strong>. Проверьте свою почту.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
