import React from 'react';
import { User, Mail, Calendar, Lock, Bell, Globe, Loader2, Upload, Trash2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { useApp } from '../contexts/app-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner@2.0.3';
// Removed: import { projectId, publicAnonKey } from '../utils/supabase/info';

export function ProfileView() {
  const { currentUser, updateCurrentUser, uploadAvatar, deleteAvatar, refreshData, tasks, deleteTask } = useApp();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [notifications, setNotifications] = React.useState(true);
  const [emailDigest, setEmailDigest] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load user data when component mounts or currentUser changes
  React.useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // Track changes
  React.useEffect(() => {
    if (currentUser) {
      const changed = name !== currentUser.name;
      setHasChanges(changed);
    }
  }, [name, currentUser]);

  const handleSave = async () => {
    if (!currentUser || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateCurrentUser({ name });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentUser) {
      setName(currentUser.name || '');
      setHasChanges(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Неверный формат файла. Используйте JPG, PNG, GIF или WEBP');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимальный размер 2MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
    } catch (error) {
      console.error('Avatar upload error:', error);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAvatar = async () => {
    if (!currentUser?.avatarUrl) return;

    setIsUploadingAvatar(true);
    try {
      await deleteAvatar();
    } catch (error) {
      console.error('Avatar delete error:', error);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!currentUser) return;
    
    setIsCleaningDuplicates(true);
    try {
      // Find duplicate tasks (same title within same project/status)
      const taskMap = new Map<string, any>();
      const duplicates: string[] = [];
      
      tasks.forEach((task: any) => {
        const key = `${task.title}-${task.projectId || 'none'}-${task.status}`;
        
        if (!taskMap.has(key)) {
          // First task with this key
          taskMap.set(key, task);
        } else {
          // Duplicate found - keep the newer one
          const existing = taskMap.get(key)!;
          const existingDate = new Date(existing.createdAt || 0).getTime();
          const currentDate = new Date(task.createdAt || 0).getTime();
          
          if (currentDate > existingDate) {
            // Current task is newer, mark existing as duplicate and replace
            duplicates.push(existing.id);
            taskMap.set(key, task);
          } else {
            // Existing task is newer, mark current as duplicate
            duplicates.push(task.id);
          }
        }
      });
      
      if (duplicates.length > 0) {
        // Delete duplicates using existing API
        console.log(`Найдено дубликатов: ${duplicates.length}`);
        for (const taskId of duplicates) {
          await deleteTask(taskId);
        }
        
        toast.success(`Удалено дубликатов: ${duplicates.length}. Обновляем данные...`);
        await refreshData();
      } else {
        toast.success('Дубликаты не найдены. Все задачи в порядке!');
      }
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast.error(error.message || 'Ошибка очистки дубликатов');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-gray-900 mb-1">Профиль</h1>
          <p className="text-gray-600">Управление настройками аккаунта</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Личная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="w-20 h-20">
                  {currentUser.avatarUrl && (
                    <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                  )}
                  <AvatarFallback className="text-2xl bg-purple-100 text-purple-600">
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Изменить фото
                        </>
                      )}
                    </Button>
                    {currentUser.avatarUrl && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDeleteAvatar}
                        disabled={isUploadingAvatar}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    JPG, PNG, GIF или WEBP. Максимум 2MB
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">
                    <User className="w-4 h-4 inline mr-2" />
                    Полное имя
                  </Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-email">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-joined">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Дата регистрации
                  </Label>
                  <Input
                    id="profile-joined"
                    value={currentUser.createdAt ? format(new Date(currentUser.createdAt), 'dd MMMM yyyy', { locale: ru }) : 'Неизвестно'}
                    disabled
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={!hasChanges || isSaving}
                >
                  Отмена
                </Button>
                <Button 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    'Сохранить изменения'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Безопасность</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-gray-500" />
                  <div>
                    <p>Пароль</p>
                    <p className="text-sm text-gray-500">
                      Последнее изменение: 2 недели назад
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Изменить пароль
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Уведомления</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-500" />
                  <div>
                    <p>Push-уведомления</p>
                    <p className="text-sm text-gray-500">
                      Получать уведомления о новых задачах
                    </p>
                  </div>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <div>
                    <p>Email дайджест</p>
                    <p className="text-sm text-gray-500">
                      Еженедельная сводка по задачам
                    </p>
                  </div>
                </div>
                <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">
                  <Globe className="w-4 h-4 inline mr-2" />
                  Язык интерфейса
                </Label>
                <Input id="language" value="Русский" disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Обслуживание</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p>Очистить дубликаты задач</p>
                  <p className="text-sm text-gray-500">
                    Удалить дублирующиеся записи задач из базы данных
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCleanupDuplicates}
                  disabled={isCleaningDuplicates}
                >
                  {isCleaningDuplicates ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Очистка...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Очистить
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Опасная зона</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p>Удалить аккаунт</p>
                  <p className="text-sm text-gray-500">
                    Это действие нельзя будет отменить
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Удалить аккаунт
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
