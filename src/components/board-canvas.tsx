import React from 'react';
import { boardsAPI } from '../utils/api-client';
import { Board, BoardElement } from '../types';
import { BoardToolbar } from './board-toolbar';
import { BoardElementComponent } from './board-element';
import { Button } from './ui/button';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, Undo, Redo, Focus } from 'lucide-react';
import { toast } from 'sonner';

interface BoardCanvasProps {
  boardId: string;
  onBack: () => void;
}

export function BoardCanvas({ boardId, onBack }: BoardCanvasProps) {
  const [board, setBoard] = React.useState<Board | null>(null);
  const [elements, setElements] = React.useState<BoardElement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedElementIds, setSelectedElementIds] = React.useState<Set<string>>(new Set());
  
  // History state
  const [history, setHistory] = React.useState<BoardElement[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const maxHistorySize = 50;
  
  // Pan & Zoom state
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  
  // Selection box state
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [selectionStart, setSelectionStart] = React.useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = React.useState({ x: 0, y: 0 });
  
  const canvasRef = React.useRef<HTMLDivElement>(null);

  // Constants
  const CANVAS_PADDING = 100; // Padding for center-on-content feature

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

  // History management
  const saveToHistory = React.useCallback(() => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(elements)));
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [elements, historyIndex]);

  const handleUndo = React.useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setElements(previousState);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  const handleRedo = React.useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setElements(nextState);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  // Add new element
  const handleAddElement = React.useCallback(async (type: 'note' | 'image' | 'heading' | 'text', imageUrl?: string) => {
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
      setSelectedElementIds(new Set([newElement.id]));
      toast.success('Элемент добавлен');
    } catch (error) {
      console.error('Failed to add element:', error);
      toast.error('Не удалось добавить элемент');
    }
  }, [boardId, scale, offset, elements.length]);

  // Handle paste from clipboard
  React.useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't interfere with paste in text inputs
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          
          const file = item.getAsFile();
          if (file) {
            try {
              const { url } = await boardsAPI.uploadImage(boardId, file);
              await handleAddElement('image', url);
              toast.success('Изображение вставлено');
            } catch (error) {
              console.error('Failed to paste image:', error);
              toast.error('Не удалось вставить изображение');
            }
          }
          break;
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [boardId, handleAddElement]);

  // Debounced history saving
  const saveHistoryDebounced = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    if (elements.length > 0) {
      clearTimeout(saveHistoryDebounced.current);
      saveHistoryDebounced.current = setTimeout(() => {
        saveToHistory();
      }, 1000);
    }
  }, [elements, saveToHistory]);

  // Keyboard shortcuts for Undo/Redo
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Не перехватывать если фокус в input/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

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
      setSelectedElementIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(elementId);
        return newSet;
      });
      toast.success('Элемент удалён');
    } catch (error) {
      console.error('Failed to delete element:', error);
      toast.error('Не удалось удалить элемент');
    }
  };

  // Element selection handlers
  const handleElementSelect = (elementId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+click - add/remove from selection
      setSelectedElementIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(elementId)) {
          newSet.delete(elementId);
        } else {
          newSet.add(elementId);
        }
        return newSet;
      });
    } else {
      // Normal click - select only this element
      setSelectedElementIds(new Set([elementId]));
    }
  };

  // Multi-element drag handler
  // Note: This makes individual API calls per element, but uses optimistic updates
  // for immediate UI feedback. A batch API endpoint would be more efficient but
  // would require backend changes.
  const handleGroupDrag = (deltaX: number, deltaY: number) => {
    selectedElementIds.forEach(elementId => {
      const element = elements.find(el => el.id === elementId);
      if (element) {
        handleElementUpdate(elementId, {
          positionX: element.positionX + deltaX,
          positionY: element.positionY + deltaY
        });
      }
    });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvas) {
      // Если зажат Shift — начинаем выделение областью
      if (e.shiftKey) {
        setIsSelecting(true);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const startX = (e.clientX - rect.left - offset.x) / scale;
          const startY = (e.clientY - rect.top - offset.y) / scale;
          setSelectionStart({ x: startX, y: startY });
          setSelectionEnd({ x: startX, y: startY });
        }
      } else {
        // Иначе — panning
        setIsPanning(true);
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        setSelectedElementIds(new Set());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (isSelecting) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const endX = (e.clientX - rect.left - offset.x) / scale;
        const endY = (e.clientY - rect.top - offset.y) / scale;
        setSelectionEnd({ x: endX, y: endY });
      }
    }
  };

  const handleMouseUp = () => {
    if (isSelecting) {
      // Определить элементы в выделенной области
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);
      
      const selectedIds = new Set<string>();
      elements.forEach(el => {
        // Проверка пересечения элемента с областью выделения
        if (
          el.positionX < maxX &&
          el.positionX + el.width > minX &&
          el.positionY < maxY &&
          el.positionY + el.height > minY
        ) {
          selectedIds.add(el.id);
        }
      });
      
      setSelectedElementIds(selectedIds);
      setIsSelecting(false);
    }
    setIsPanning(false);
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Mouse position relative to canvas
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Mouse position in content coordinates (before zoom)
      const contentX = (mouseX - offset.x) / scale;
      const contentY = (mouseY - offset.y) / scale;
      
      // New scale
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * delta, 0.25), 4);
      
      // New offset so point under cursor stays in place
      const newOffsetX = mouseX - contentX * newScale;
      const newOffsetY = mouseY - contentY * newScale;
      
      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.25));

  // Center on content
  const handleCenterOnContent = React.useCallback(() => {
    if (elements.length === 0) {
      // If no elements - just reset view
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    // Find bounding box of all elements
    const minX = Math.min(...elements.map(el => el.positionX));
    const minY = Math.min(...elements.map(el => el.positionY));
    const maxX = Math.max(...elements.map(el => el.positionX + el.width));
    const maxY = Math.max(...elements.map(el => el.positionY + el.height));
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;
    
    const canvasWidth = canvasRef.current?.clientWidth || 800;
    const canvasHeight = canvasRef.current?.clientHeight || 600;
    
    // Calculate scale to fit content with padding
    const scaleX = (canvasWidth - CANVAS_PADDING * 2) / contentWidth;
    const scaleY = (canvasHeight - CANVAS_PADDING * 2) / contentHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 2);
    
    // Center
    setScale(newScale);
    setOffset({
      x: canvasWidth / 2 - contentCenterX * newScale,
      y: canvasHeight / 2 - contentCenterY * newScale
    });
  }, [elements]);

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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo} 
            disabled={historyIndex <= 0}
            title="Отменить (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRedo} 
            disabled={historyIndex >= history.length - 1}
            title="Повторить (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleCenterOnContent} title="Центрировать на контенте">
            <Focus className="w-4 h-4" />
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
              isSelected={selectedElementIds.has(element.id)}
              onSelect={(e) => handleElementSelect(element.id, e)}
              onUpdate={(updates) => handleElementUpdate(element.id, updates)}
              onDelete={() => handleElementDelete(element.id)}
              onDragDelta={selectedElementIds.size > 1 ? handleGroupDrag : undefined}
              scale={scale}
              offset={offset}
            />
          ))}
          
          {/* Selection box */}
          {isSelecting && (
            <div
              className="absolute border-2 border-purple-500 bg-purple-100 bg-opacity-20 pointer-events-none"
              style={{
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y)
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
