import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { 
  extractYouTubeId, 
  getYouTubeMetadata, 
  detectVideoType,
  getInstagramContentType
} from '../../utils/video-parser';
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

interface VideoMetadata {
  title: string;
  thumbnail: string;
  description: string;
  author: string;
}

export function VideoDialog({ open, onOpenChange, onInsert }: VideoDialogProps) {
  const [url, setUrl] = React.useState('');
  const [displayMode, setDisplayMode] = React.useState<'embed' | 'preview'>('embed');
  const [videoType, setVideoType] = React.useState<'youtube' | 'instagram' | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [metadata, setMetadata] = React.useState<VideoMetadata | null>(null);

  // Handle URL change with auto-detection
  const handleUrlChange = async (value: string) => {
    setUrl(value);
    setError('');
    setMetadata(null);
    
    if (!value.trim()) {
      setVideoType(null);
      return;
    }
    
    const type = detectVideoType(value);
    setVideoType(type);
    
    if (!type) {
      setError('Поддерживаются только YouTube и Instagram');
      return;
    }
    
    // For Instagram, set preview mode by default
    if (type === 'instagram') {
      setDisplayMode('preview');
    }
    
    // Load metadata for YouTube
    if (type === 'youtube') {
      setLoading(true);
      try {
        const meta = await getYouTubeMetadata(value);
        setMetadata(meta);
      } catch (err) {
        console.error('Failed to load YouTube metadata:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInsert = () => {
    if (!videoType) return;
    
    if (videoType === 'youtube') {
      onInsert({
        url,
        displayMode,
        metadata
      });
    } else if (videoType === 'instagram') {
      onInsert({
        url,
        displayMode: 'preview',
        metadata: {
          title: getInstagramContentType(url) === 'reel' ? 'Instagram Reel' : 'Instagram Post',
          thumbnail: '',
          description: '',
          author: 'Instagram'
        }
      });
    }
    
    // Reset state
    setUrl('');
    setDisplayMode('embed');
    setVideoType(null);
    setError('');
    setMetadata(null);
    onOpenChange(false);
  };

  const isInsertDisabled = !url || !videoType || !!error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Вставить видео</DialogTitle>
          <DialogDescription>
            Вставьте ссылку на YouTube или Instagram
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="video-url">URL</Label>
            <Input
              id="video-url"
              placeholder="https://youtube.com/watch?v=... или https://instagram.com/p/..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
            
            {/* Detection Status */}
            {videoType === 'youtube' && (
              <p className="text-sm text-green-600 mt-1">
                ✅ YouTube видео определено
              </p>
            )}
            {videoType === 'instagram' && (
              <p className="text-sm text-green-600 mt-1">
                ✅ Instagram {getInstagramContentType(url) === 'reel' ? 'Reel' : 'пост'} определен
              </p>
            )}
            
            {/* Error Message */}
            {error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 font-medium">❌ {error}</p>
                <p className="text-xs text-red-500 mt-1">Поддерживаются только:</p>
                <ul className="text-xs text-red-500 list-disc list-inside mt-1">
                  <li>YouTube (youtube.com, youtu.be)</li>
                  <li>Instagram (instagram.com)</li>
                </ul>
              </div>
            )}
          </div>
          
          {/* Display Mode - ONLY for YouTube */}
          {videoType === 'youtube' && (
            <div className="space-y-2">
              <Label>Режим отображения</Label>
              <RadioGroup value={displayMode} onValueChange={(v) => setDisplayMode(v as 'embed' | 'preview')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="embed" id="embed" />
                  <Label htmlFor="embed" className="font-normal cursor-pointer">
                    Плеер (Embed)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preview" id="preview" />
                  <Label htmlFor="preview" className="font-normal cursor-pointer">
                    Тизер (Preview)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          {/* Instagram Information */}
          {videoType === 'instagram' && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-3xl">📷</div>
                <div>
                  <p className="font-medium text-gray-900">
                    Instagram {getInstagramContentType(url) === 'reel' ? 'Reel' : 'Post'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Откроется в новой вкладке при клике
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* YouTube Metadata Preview */}
          {videoType === 'youtube' && metadata && (
            <div className="border rounded-lg p-3">
              {metadata.thumbnail && (
                <img src={metadata.thumbnail} alt="Thumbnail" className="w-full rounded" />
              )}
              <p className="font-medium mt-2">{metadata.title}</p>
              <p className="text-sm text-gray-600">{metadata.author}</p>
            </div>
          )}
          
          {/* Loading indicator for YouTube metadata */}
          {videoType === 'youtube' && loading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">Загрузка метаданных...</span>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleInsert} disabled={isInsertDisabled}>
            Вставить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
