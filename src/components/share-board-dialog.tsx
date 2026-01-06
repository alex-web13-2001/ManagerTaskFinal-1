
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { boardsAPI } from '../utils/api-client';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

interface ShareBoardDialogProps {
  boardId: string;
  isPublic: boolean;
  publicToken: string;
  onUpdate: (data: { isPublic: boolean; publicToken?: string }) => void;
  children: React.ReactNode;
}

export function ShareBoardDialog({ boardId, isPublic, publicToken, onUpdate, children }: ShareBoardDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const publicUrl = publicToken ? `${window.location.origin}/public/board/${publicToken}` : '';

  const handleToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      const updatedBoard = await boardsAPI.toggleSharing(boardId, checked);
      onUpdate({ isPublic: updatedBoard.isPublic, publicToken: updatedBoard.publicToken });
      
      if (checked) {
        toast.success('Публичный доступ включен');
      } else {
        toast.success('Публичный доступ выключен');
      }
    } catch (error) {
      console.error('Failed to toggle sharing:', error);
      toast.error('Не удалось изменить настройки доступа');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Ссылка скопирована');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-[500px] w-full gap-6">
        <DialogHeader>
          <DialogTitle>Поделиться доской</DialogTitle>
          <DialogDescription>
            Настройте права доступа к этой доске.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 shadow-sm bg-gray-50/50">
            <div className="space-y-0.5">
              <Label htmlFor="public-mode" className="text-base font-medium">Публичный доступ</Label>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Любой пользователь со ссылкой сможет просматривать эту доску без регистрации.
              </p>
            </div>
            <Switch
              id="public-mode"
              checked={isPublic}
              onCheckedChange={handleToggle}
              disabled={loading}
            />
          </div>
          
          {isPublic && publicUrl && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t">
              <Label htmlFor="link" className="text-sm font-medium">Публичная ссылка</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="link"
                  value={publicUrl}
                  readOnly
                  className="flex-1 bg-muted/50 font-mono text-xs h-9"
                />
                <Button type="button" size="icon" variant="secondary" onClick={copyToClipboard} className="h-9 w-9 shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Эта ссылка предоставляет доступ только к этой доске в режиме чтения.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
