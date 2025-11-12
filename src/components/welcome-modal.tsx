import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Проверяем параметр welcome в URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === 'true') {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    // Убираем параметр welcome из URL
    const url = new URL(window.location.href);
    url.searchParams.delete('welcome');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[90%] sm:w-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <DialogTitle className="text-2xl text-center">
            Добро пожаловать в Task Manager T24!
          </DialogTitle>
          <DialogDescription className="text-center text-base space-y-3 pt-4">
            <p>
              Ваш аккаунт успешно активирован и готов к работе.
            </p>
            <p>
              Создавайте проекты, управляйте задачами и эффективно работайте в команде!
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button 
            onClick={handleClose}
            className="w-full sm:w-auto px-8"
            size="lg"
          >
            Начать пользоваться
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
