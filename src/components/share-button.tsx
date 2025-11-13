import { Share2, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface ShareButtonProps {
  url: string; // Относительный путь, например "/tasks/123"
  title?: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  
  const handleShare = async () => {
    const fullUrl = `${window.location.origin}${url}`;
    
    // Web Share API (работает на мобильных)
    if (navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl });
        return;
      } catch (err) {
        // Пользователь отменил или API недоступно
      }
    }
    
    // Fallback: копирование
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Ссылка скопирована!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Не удалось скопировать ссылку');
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="text-gray-600 hover:text-gray-900"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-2 text-green-600" />
          Скопировано!
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4 mr-2" />
          Поделиться
        </>
      )}
    </Button>
  );
}
