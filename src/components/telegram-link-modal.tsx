import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Loader2, Copy, CheckCircle2, ExternalLink, Unlink } from 'lucide-react';
import { telegramAPI } from '../utils/api-client';
import { toast } from 'sonner';

type TelegramLinkModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TelegramLinkModal({ open, onOpenChange }: TelegramLinkModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [linked, setLinked] = React.useState(false);
  const [username, setUsername] = React.useState<string | null>(null);
  const [linkToken, setLinkToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null);

  // Load status when modal opens
  React.useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const status = await telegramAPI.getStatus();
      setLinked(status.linked);
      setUsername(status.username || null);
      
      if (!status.linked) {
        // Generate token for linking
        const tokenData = await telegramAPI.generateLinkToken();
        if (!tokenData.linked) {
          setLinkToken(tokenData.token || null);
          setExpiresAt(tokenData.expiresAt ? new Date(tokenData.expiresAt) : null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch Telegram status:', error);
      toast.error('Не удалось загрузить статус Telegram');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (!linkToken) return;
    
    try {
      // Попытка современного API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(linkToken);
        setCopied(true);
        toast.success('Код скопирован в буфер обмена');
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = linkToken;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        toast.success('Код скопирован');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Не удалось скопировать. Выделите код вручную.');
    }
  };

  const handleOpenTelegram = () => {
    window.open('https://t.me/t24_robobot', '_blank');
  };

  const handleUnlink = async () => {
    try {
      await telegramAPI.unlink();
      toast.success('Telegram аккаунт отвязан');
      fetchStatus();
    } catch (error) {
      console.error('Failed to unlink Telegram:', error);
      toast.error('Не удалось отвязать аккаунт');
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (linked) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Telegram подключен
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ваш аккаунт успешно связан с Telegram.
              {username && ` (@${username})`}
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✅ Вы будете получать уведомления о назначенных задачах в Telegram
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleOpenTelegram}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Открыть бота
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleUnlink}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Отвязать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Подключить Telegram бота</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Получайте уведомления о назначенных задачах прямо в Telegram!
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">Инструкция:</h4>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Откройте бота в Telegram</li>
              <li>Нажмите /start</li>
              <li>Отправьте код подключения боту</li>
            </ol>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Код подключения:</label>
            <div className="flex gap-2">
              <div 
                className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 font-mono text-lg text-center text-gray-900 font-bold select-all cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={handleCopyToken}
                title="Нажмите для копирования"
              >
                {linkToken}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyToken}
                className="shrink-0"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Код скопирован в буфер обмена
              </p>
            )}
            {expiresAt && (
              <p className="text-xs text-gray-500">
                Код действителен до: {expiresAt.toLocaleTimeString('ru-RU')}
              </p>
            )}
          </div>
          
          <Button
            className="w-full bg-blue-500 hover:bg-blue-600"
            onClick={handleOpenTelegram}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Открыть @t24_robobot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
