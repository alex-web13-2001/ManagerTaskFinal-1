import React from 'react';
import { boardsAPI } from '../utils/api-client';
import { Board, BoardElement } from '../types';
import { BoardToolbar } from './board-toolbar';
import { BoardElementComponent } from './board-element';
import { Button } from './ui/button';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface BoardCanvasProps {
  boardId: string;
  onBack: () => void;
}

export function BoardCanvas({ boardId, onBack }: BoardCanvasProps) {
  const [board, setBoard] = React.useState<Board | null>(null);
  const [elements, setElements] = React.useState<BoardElement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  
  // Pan & Zoom state
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  
  const canvasRef = React.useRef<HTMLDivElement>(null);

  // Load board with elements
  React.useEffect(() => {
    loadBoard();
  }, [boardId]);

  const loadBoard = async () => {
    try {
      setLoading(true);
      const data = await boardsAPI.getById(boardId);
      setBoard(data);
      setElements(data.elements || []);
    } catch (error) {
      console.error('Failed to load board:', error);
      toast.error('Не удалось загрузить доску');
    } finally {
      setLoading(false);
    }
  };

  // Add new element
  const handleAddElement = async (type: 'note' | 'image' | 'heading' | 'text', imageUrl?: string) => {
    const defaultProps = {
      note: { width: 200, height: 150, color: '#fef08a', content: '' },
      image: { width: 300, height: 200, imageUrl: imageUrl || '' },
      heading: { width: 300, height: 50, content: 'Заголовок', fontSize: 24 },
      text: { width: 300, height: 100, content: 'Текст', fontSize: 14 }
    };

    try {
      const centerX = (canvasRef.current?.clientWidth || 800) / 2 / scale - offset.x / scale;
      const centerY = (canvasRef.current?.clientHeight || 600) / 2 / scale - offset.y / scale;

      const newElement = await boardsAPI.createElement(boardId, {
        type,
        positionX: centerX - defaultProps[type].width / 2,
        positionY: centerY - defaultProps[type].height / 2,
        zIndex: elements.length,
        ...defaultProps[type]
      });
      
      setElements(prev => [...prev, newElement]);
      setSelectedElementId(newElement.id);
      toast.success('Элемент добавлен');
    } catch (error) {
      console.error('Failed to add element:', error);
      toast.error('Не удалось добавить элемент');
    }
  };

  // Update element position/size
  const handleElementUpdate = async (elementId: string, updates: Partial<BoardElement>) => {
    try {
      // Optimistic update
      setElements(prev => prev.map(el => el.id === elementId ? { ...el, ...updates } : el));
      
      // Debounced server update
      await boardsAPI.updateElement(boardId, elementId, updates);
    } catch (error) {
      console.error('Failed to update element:', error);
      loadBoard(); // Rollback
    }
  };

  // Delete element
  const handleElementDelete = async (elementId: string) => {
    try {
      await boardsAPI.deleteElement(boardId, elementId);
      setElements(prev => prev.filter(el => el.id !== elementId));
      setSelectedElementId(null);
      toast.success('Элемент удалён');
    } catch (error) {
      console.error('Failed to delete element:', error);
      toast.error('Не удалось удалить элемент');
    }
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvas) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      setSelectedElementId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.min(Math.max(prev * delta, 0.25), 4));
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.25));
  const handleResetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  // Image upload
  const handleImageUpload = async (file: File) => {
    try {
      const { url } = await boardsAPI.uploadImage(boardId, file);
      await handleAddElement('image', url);
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Не удалось загрузить изображение');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: board?.color }} />
          <h1 className="font-semibold">{board?.name}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetView}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <BoardToolbar
        onAddNote={() => handleAddElement('note')}
        onAddHeading={() => handleAddElement('heading')}
        onAddText={() => handleAddElement('text')}
        onAddImage={handleImageUpload}
      />

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        data-canvas="true"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="relative w-full h-full"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #ddd 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />
          
          {/* Elements */}
          {elements.map(element => (
            <BoardElementComponent
              key={element.id}
              element={element}
              isSelected={selectedElementId === element.id}
              onSelect={() => setSelectedElementId(element.id)}
              onUpdate={(updates) => handleElementUpdate(element.id, updates)}
              onDelete={() => handleElementDelete(element.id)}
              scale={scale}
              offset={offset}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
