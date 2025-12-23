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
    metadata?: {
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
    
    // For Instagram, set preview mode by default and load metadata
    if (type === 'instagram') {
      setDisplayMode('preview');
      setLoading(true);
      try {
        const response = await fetch(
          `/api/instagram-metadata?url=${encodeURIComponent(value)}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch metadata');
        }
        
        const data = await response.json();
        
        // Если есть fallback (ошибка на backend), используем его
        if (data.fallback) {
          setMetadata(data.fallback);
        } else {
          setMetadata(data);
        }
      } catch (err) {
        console.error('Failed to load Instagram metadata:', err);
        // Fallback к статичным данным
        setMetadata({
          title: getInstagramContentType(value) === 'reel' ? 'Instagram Reel' : 'Instagram Post',
          thumbnail: '',
          description: '',
          author: 'Instagram',
        });
      } finally {
        setLoading(false);
      }
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
    
    onInsert({
      url,
      displayMode: videoType === 'instagram' ? 'preview' : displayMode,
      metadata: metadata || undefined,
    });
    
    // Reset state
    setUrl('');
    setDisplayMode('embed');
    setVideoType(null);
    setError('');
    setMetadata(null);
    onOpenChange(false);
  };

  const isInsertDisabled = !url || !videoType || !!error || loading;

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
            {videoType === 'youtube' && !loading && (
              <p className="text-sm text-green-600 mt-1">
                ✅ YouTube видео определено
              </p>
            )}
            {videoType === 'instagram' && !loading && (
              <p className="text-sm text-green-600 mt-1">
                ✅ Instagram {getInstagramContentType(url) === 'reel' ? 'Reel' : 'пост'} определен
              </p>
            )}
            
            {/* Loading */}
            {loading && (
              <p className="text-sm text-blue-600 mt-2">Загрузка данных...</p>
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
          
          {/* Instagram preview с metadata */}
          {videoType === 'instagram' && metadata && (
            <div className="border rounded-lg overflow-hidden">
              {metadata.thumbnail ? (
                <div className="relative">
                  <img 
                    src={metadata.thumbnail} 
                    alt="Instagram preview" 
                    className="w-full aspect-square object-cover"
                  />
                  <div 
                    className="absolute inset-0 flex flex-col items-center justify-center text-white p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(131, 58, 180, 0.8) 0%, rgba(193, 53, 132, 0.8) 50%, rgba(225, 48, 108, 0.8) 70%, rgba(253, 29, 29, 0.8) 85%, rgba(247, 119, 55, 0.8) 100%)'
                    }}
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      width="48" 
                      height="48" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-2"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none" />
                    </svg>
                    <p className="text-sm font-semibold text-center drop-shadow-lg">
                      {metadata.author}
                    </p>
                  </div>
                </div>
              ) : (
                <div 
                  className="w-full aspect-square flex flex-col items-center justify-center text-white"
                  style={{
                    background: 'linear-gradient(135deg, #833AB4 0%, #C13584 50%, #E1306C 70%, #FD1D1D 85%, #F77737 100%)'
                  }}
                >
                  <svg 
                    viewBox="0 0 24 24" 
                    width="64" 
                    height="64" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-3"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none" />
                  </svg>
                  <p className="font-bold text-lg">Instagram {getInstagramContentType(url) === 'reel' ? 'Reel' : 'Post'}</p>
                </div>
              )}
              <div className="p-3 bg-white">
                <p className="text-sm line-clamp-2">{metadata.title}</p>
              </div>
            </div>
          )}
          
          {/* YouTube Metadata Preview */}
          {videoType === 'youtube' && metadata && (
            <div className="border rounded-lg overflow-hidden">
              {metadata.thumbnail && (
                <img 
                  src={metadata.thumbnail} 
                  alt="Thumbnail" 
                  className="w-full aspect-video object-cover" 
                />
              )}
              <div className="p-3">
                <p className="font-medium line-clamp-2">{metadata.title}</p>
                <p className="text-sm text-gray-600 mt-1">{metadata.author}</p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleInsert} disabled={isInsertDisabled}>
            {loading ? 'Загрузка...' : 'Вставить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
