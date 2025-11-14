import React, { useState, useEffect } from 'react';
import { CheckCircle, MessageCircle } from 'lucide-react';
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

  const handleOpenTelegram = () => {
    // Close welcome modal
    setOpen(false);
    
    // Убираем параметр welcome из URL
    const url = new URL(window.location.href);
    url.searchParams.delete('welcome');
    window.history.replaceState({}, '', url.toString());
    
    // Dispatch custom event to open Telegram modal
    window.dispatchEvent(new CustomEvent('openTelegramModal'));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[600px]">
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
        
        {/* Telegram Bot Recommendation Block */}
        <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">
                Подключите Telegram-бота! 🤖
              </h3>
              <p className="text-sm text-blue-800 mb-3">
                Получайте мгновенные уведомления о назначенных задачах и приглашениях в проекты прямо в Telegram.
              </p>
              <Button
                onClick={handleOpenTelegram}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                Подключить сейчас
              </Button>
            </div>
          </div>
        </div>
        
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
