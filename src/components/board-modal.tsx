import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Loader2 } from 'lucide-react';
import { useBoards } from '../contexts/boards-context';

type BoardModalMode = 'create' | 'edit';

type BoardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BoardModalMode;
  boardId?: string;
  onSave?: (board: any) => void;
};

const colorOptions = [
  { id: '#3b82f6', label: 'Синий', color: 'bg-blue-500' },
  { id: '#8b5cf6', label: 'Фиолетовый', color: 'bg-purple-500' },
  { id: '#10b981', label: 'Зелёный', color: 'bg-green-500' },
  { id: '#f59e0b', label: 'Оранжевый', color: 'bg-orange-500' },
  { id: '#ef4444', label: 'Красный', color: 'bg-red-500' },
  { id: '#ec4899', label: 'Розовый', color: 'bg-pink-500' },
  { id: '#6366f1', label: 'Индиго', color: 'bg-indigo-500' },
  { id: '#eab308', label: 'Жёлтый', color: 'bg-yellow-500' },
];

export function BoardModal({
  open,
  onOpenChange,
  mode,
  boardId,
  onSave,
}: BoardModalProps) {
  const { boards, createBoard, updateBoard } = useBoards();
  const [isLoading, setIsLoading] = React.useState(false);
  const prevOpenRef = React.useRef(false);

  const isEditMode = mode === 'edit';
  const existingBoard = boardId && isEditMode ? boards.find(b => b.id === boardId) : null;

  // Form state
  const [name, setName] = React.useState(existingBoard?.name || '');
  const [description, setDescription] = React.useState(existingBoard?.description || '');
  const [selectedColor, setSelectedColor] = React.useState(existingBoard?.color || '#3b82f6');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    // Only run when modal opens (transitions from closed to open)
    if (open && !prevOpenRef.current) {
      if (isEditMode && boardId) {
        const board = boards.find(b => b.id === boardId);
        if (board) {
          setName(board.name || '');
          setDescription(board.description || '');
          setSelectedColor(board.color || '#3b82f6');
        }
      } else if (!isEditMode) {
        resetForm();
      }
    }
    prevOpenRef.current = open;
  }, [open, isEditMode, boardId, boards]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedColor('#3b82f6');
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Название обязательно для заполнения';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const boardData = {
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
      };

      let savedBoard;
      if (isEditMode && boardId) {
        savedBoard = await updateBoard(boardId, boardData);
      } else {
        savedBoard = await createBoard(boardData);
      }

      if (onSave) {
        onSave(savedBoard);
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save board:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Редактировать доску' : 'Создать доску'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Измените параметры доски'
              : 'Создайте новую доску для визуализации идей и заметок'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Название <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Моя доска"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание доски (необязательно)"
              rows={3}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Цвет</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedColor(option.id)}
                  className={`w-10 h-10 rounded-full ${option.color} transition-transform hover:scale-110 ${
                    selectedColor === option.id
                      ? 'ring-2 ring-offset-2 ring-gray-900'
                      : ''
                  }`}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
