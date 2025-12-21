import React from 'react';
import { BoardElement } from '../types';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface BoardElementComponentProps {
  element: BoardElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardElement>) => void;
  onDelete: () => void;
  scale: number;
  offset: { x: number; y: number };
}

export function BoardElementComponent({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  scale,
  offset
}: BoardElementComponentProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = React.useState({ width: 0, height: 0, x: 0, y: 0 });
  const elementRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    // Store the offset from mouse to element's top-left corner in canvas space
    setDragStart({
      x: (e.clientX - offset.x) / scale - element.positionX,
      y: (e.clientY - offset.y) / scale - element.positionY
    });
  };

  const handleDrag = React.useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    // Calculate new position in canvas space
    const newX = (e.clientX - offset.x) / scale - dragStart.x;
    const newY = (e.clientY - offset.y) / scale - dragStart.y;
    onUpdate({ positionX: newX, positionY: newY });
  }, [isDragging, dragStart, scale, offset, onUpdate]);

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      width: element.width,
      height: element.height,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleResize = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = (e.clientX - resizeStart.x) / scale;
    const deltaY = (e.clientY - resizeStart.y) / scale;
    onUpdate({
      width: Math.max(50, resizeStart.width + deltaX),
      height: Math.max(30, resizeStart.height + deltaY)
    });
  }, [isResizing, resizeStart, scale, onUpdate]);

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  // Content editing
  const handleDoubleClick = () => {
    if (element.type !== 'image') {
      setIsEditing(true);
      setTimeout(() => textRef.current?.focus(), 0);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ content: e.target.value });
  };

  // Global mouse events
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  // Keyboard delete
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && !isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
        onDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, onDelete]);

  const renderContent = () => {
    switch (element.type) {
      case 'note':
        return (
          <div
            className="w-full h-full p-3 rounded-lg shadow-md"
            style={{ backgroundColor: element.color || '#fef08a' }}
          >
            {isEditing ? (
              <textarea
                ref={textRef}
                value={element.content || ''}
                onChange={handleContentChange}
                onBlur={handleBlur}
                className="w-full h-full bg-transparent resize-none outline-none"
                placeholder="Введите текст..."
              />
            ) : (
              <div className="w-full h-full overflow-auto whitespace-pre-wrap">
                {element.content || 'Двойной клик для редактирования'}
              </div>
            )}
          </div>
        );
      
      case 'image':
        return (
          <img
            src={element.imageUrl}
            alt="Board image"
            className="w-full h-full object-cover rounded-lg"
            draggable={false}
          />
        );
      
      case 'heading':
        return isEditing ? (
          <textarea
            ref={textRef}
            value={element.content || ''}
            onChange={handleContentChange}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent resize-none outline-none font-bold"
            style={{ fontSize: element.fontSize || 24 }}
          />
        ) : (
          <div
            className="font-bold"
            style={{ fontSize: element.fontSize || 24 }}
          >
            {element.content || 'Заголовок'}
          </div>
        );
      
      case 'text':
        return isEditing ? (
          <textarea
            ref={textRef}
            value={element.content || ''}
            onChange={handleContentChange}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent resize-none outline-none"
            style={{ fontSize: element.fontSize || 14 }}
          />
        ) : (
          <div
            className="whitespace-pre-wrap"
            style={{ fontSize: element.fontSize || 14 }}
          >
            {element.content || 'Текст'}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div
      ref={elementRef}
      className={cn(
        'absolute cursor-move',
        isSelected && 'ring-2 ring-purple-500 ring-offset-2'
      )}
      style={{
        left: element.positionX,
        top: element.positionY,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        transform: `rotate(${element.rotation || 0}deg)`
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={handleDragStart}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent()}

      {/* Selection controls */}
      {isSelected && (
        <>
          {/* Delete button */}
          <Button
            variant="destructive"
            size="sm"
            className="absolute -top-3 -right-3 w-6 h-6 p-0 rounded-full"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>

          {/* Resize handle */}
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize"
            onMouseDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
}
