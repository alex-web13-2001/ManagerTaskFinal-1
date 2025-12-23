import React from 'react';
import { Button } from './ui/button';
import { StickyNote, Type, Heading1, Image, Video } from 'lucide-react';
import { toast } from 'sonner';

interface BoardToolbarProps {
  onAddNote: () => void;
  onAddHeading: () => void;
  onAddText: () => void;
  onAddImage: (file: File) => void;
  onAddVideo: () => void;
}

export function BoardToolbar({ onAddNote, onAddHeading, onAddText, onAddImage, onAddVideo }: BoardToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Пожалуйста, выберите изображение');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Изображение слишком большое (макс. 10MB)');
        return;
      }
      onAddImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b">
      <span className="text-sm text-gray-500 mr-2">Добавить:</span>
      
      <Button variant="outline" size="sm" onClick={onAddNote}>
        <StickyNote className="w-4 h-4 mr-2" />
        Заметка
      </Button>
      
      <Button variant="outline" size="sm" onClick={onAddHeading}>
        <Heading1 className="w-4 h-4 mr-2" />
        Заголовок
      </Button>
      
      <Button variant="outline" size="sm" onClick={onAddText}>
        <Type className="w-4 h-4 mr-2" />
        Текст
      </Button>
      
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Image className="w-4 h-4 mr-2" />
        Изображение
      </Button>
      
      <Button variant="outline" size="sm" onClick={onAddVideo}>
        <Video className="w-4 h-4 mr-2" />
        Видео
      </Button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
    </div>
  );
}
