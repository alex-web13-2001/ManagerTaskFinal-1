import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { extractYouTubeId, getYouTubeMetadata, isYouTubeUrl } from '../../utils/video-parser';
import { Loader2 } from 'lucide-react';

interface VideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (data: {
    url: string;
    displayMode: 'embed' | 'preview';
    metadata: {
      title: string;
      thumbnail: string;
      description: string;
      author: string;
    } | null;
  }) => void;
}

export function VideoDialog({ open, onOpenChange, onInsert }: VideoDialogProps) {
  const [url, setUrl] = React.useState('');
  const [displayMode, setDisplayMode] = React.useState<'embed' | 'preview'>('embed');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleInsert = async () => {
    setError('');
    
    if (!url.trim()) {
      setError('Введите URL видео');
      return;
    }
    
    if (!isYouTubeUrl(url)) {
      setError('Пожалуйста, введите корректную ссылку YouTube');
      return;
    }
    
    setLoading(true);
    
    try {
      const metadata = await getYouTubeMetadata(url);
      
      onInsert({
        url,
        displayMode,
        metadata
      });
      
      // Reset state
      setUrl('');
      setDisplayMode('embed');
      setError('');
      onOpenChange(false);
    } catch (err) {
      setError('Не удалось загрузить метаданные видео');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Вставить видео</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">URL YouTube видео</Label>
            <Input
              id="video-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>Режим отображения</Label>
            <RadioGroup value={displayMode} onValueChange={(v) => setDisplayMode(v as 'embed' | 'preview')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="embed" id="embed" />
                <Label htmlFor="embed" className="font-normal cursor-pointer">
                  Плеер (встроенное видео)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="preview" id="preview" />
                <Label htmlFor="preview" className="font-normal cursor-pointer">
                  Превью (картинка с названием)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleInsert} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Вставить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
