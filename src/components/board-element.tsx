import React from 'react';
import { BoardElement } from '../types';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { extractYouTubeId, getInstagramContentType } from '../utils/video-parser';

// Button offset for positioning delete and resize buttons at corners
const BUTTON_CORNER_OFFSET = '-12px';

// Video aspect ratio constant (16:9)
const VIDEO_ASPECT_RATIO_PADDING = '56.25%';

// Delay to reset wasDragging flag after drag ends (prevents onClick from firing)
const DRAG_RESET_DELAY = 100;

interface BoardElementComponentProps {
  element: BoardElement;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<BoardElement>) => void;
  onDelete: () => void;
  onDragDelta?: (deltaX: number, deltaY: number) => void;
  scale: number;
  offset: { x: number; y: number };
}

export function BoardElementComponent({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDragDelta,
  scale,
  offset
}: BoardElementComponentProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [wasDragging, setWasDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = React.useState({ width: 0, height: 0, x: 0, y: 0 });
  const elementRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const lastPositionRef = React.useRef({ x: element.positionX, y: element.positionY });
  const dragResetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Refs for stable drag/resize tracking without triggering re-renders
  const isDraggingRef = React.useRef(false);
  const isResizingRef = React.useRef(false);
  const scaleRef = React.useRef(scale);
  
  // Sync scaleRef with scale prop to avoid recreating handleResize
  React.useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  
  // Refs to store current handlers for cleanup
  const handleDragRef = React.useRef<((e: MouseEvent) => void) | null>(null);
  const handleDragEndRef = React.useRef<(() => void) | null>(null);
  const handleResizeRef = React.useRef<((e: MouseEvent) => void) | null>(null);
  const handleResizeEndRef = React.useRef<(() => void) | null>(null);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();  // Prevent default browser behavior
    onSelect(e);
    isDraggingRef.current = true;  // Ref for stable tracking
    setIsDragging(true);            // State for UI updates
    // Store the offset from mouse to element's top-left corner in canvas space
    lastPositionRef.current = { x: element.positionX, y: element.positionY };
    setDragStart({
      x: (e.clientX - offset.x) / scale - element.positionX,
      y: (e.clientY - offset.y) / scale - element.positionY
    });
  };

  const handleDrag = React.useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;  // Use ref instead of state
    
    // Mark that dragging is happening
    setWasDragging(true);
    
    // Calculate new position in canvas space
    const newX = (e.clientX - offset.x) / scale - dragStart.x;
    const newY = (e.clientY - offset.y) / scale - dragStart.y;
    
    // If onDragDelta is provided (for multi-selection), calculate delta and call it
    if (onDragDelta) {
      const deltaX = newX - lastPositionRef.current.x;
      const deltaY = newY - lastPositionRef.current.y;
      if (deltaX !== 0 || deltaY !== 0) {
        onDragDelta(deltaX, deltaY);
        lastPositionRef.current = { x: newX, y: newY };
      }
    } else {
      // Otherwise, just update this element
      onUpdate({ positionX: newX, positionY: newY });
    }
  }, [scale, offset, dragStart, onUpdate, onDragDelta]);
  // Removed isDragging from dependencies to prevent function recreation
  
  // Store handler in ref for cleanup
  handleDragRef.current = handleDrag;

  const handleDragEnd = React.useCallback(() => {
    isDraggingRef.current = false;  // Clear ref
    setIsDragging(false);            // Clear state
    // Clear any existing timeout
    if (dragResetTimeoutRef.current) {
      clearTimeout(dragResetTimeoutRef.current);
    }
    // Reset the flag after a small delay to prevent onClick from firing
    dragResetTimeoutRef.current = setTimeout(() => setWasDragging(false), DRAG_RESET_DELAY);
  }, []);
  
  // Store handler in ref for cleanup
  handleDragEndRef.current = handleDragEnd;

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;  // Ref for stable tracking
    setIsResizing(true);            // State for UI updates
    setResizeStart({
      width: element.width,
      height: element.height,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleResize = React.useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;  // Use ref instead of state
    const deltaX = (e.clientX - resizeStart.x) / scaleRef.current;
    const deltaY = (e.clientY - resizeStart.y) / scaleRef.current;
    
    // For images and videos in embed mode - maintain aspect ratio
    if (element.type === 'image' || element.type === 'video') {
      const aspectRatio = resizeStart.width / resizeStart.height;
      // Use the larger delta to determine new size
      const maxDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY * aspectRatio;
      const newWidth = Math.max(50, resizeStart.width + maxDelta);
      const newHeight = newWidth / aspectRatio;
      onUpdate({ width: newWidth, height: Math.max(30, newHeight) });
    } else {
      // For other elements - free resizing
      onUpdate({
        width: Math.max(50, resizeStart.width + deltaX),
        height: Math.max(30, resizeStart.height + deltaY)
      });
    }
  }, [resizeStart, onUpdate, element.type]);
  // Removed isResizing from dependencies to prevent function recreation
  
  // Store handler in ref for cleanup
  handleResizeRef.current = handleResize;

  const handleResizeEnd = React.useCallback(() => {
    isResizingRef.current = false;  // Clear ref
    setIsResizing(false);            // Clear state
  }, []);
  
  // Store handler in ref for cleanup
  handleResizeEndRef.current = handleResizeEnd;

  // Content editing
  const handleDoubleClick = () => {
    if (element.type === 'video') {
      // Toggle display mode for video
      onUpdate({
        displayMode: element.displayMode === 'embed' ? 'preview' : 'embed'
      });
    } else if (element.type !== 'image') {
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

  // Cleanup timeout on unmount and force remove all event listeners
  React.useEffect(() => {
    return () => {
      // Force stop any ongoing drag/resize
      isDraggingRef.current = false;
      isResizingRef.current = false;
      
      // Force remove ALL listeners using refs to get current handlers
      if (handleDragRef.current) {
        window.removeEventListener('mousemove', handleDragRef.current);
      }
      if (handleDragEndRef.current) {
        window.removeEventListener('mouseup', handleDragEndRef.current);
      }
      if (handleResizeRef.current) {
        window.removeEventListener('mousemove', handleResizeRef.current);
      }
      if (handleResizeEndRef.current) {
        window.removeEventListener('mouseup', handleResizeEndRef.current);
      }
      
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
        dragResetTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only runs on mount/unmount

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
      
      case 'video':
        if (!element.videoUrl) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-sm">Нет URL видео</p>
            </div>
          );
        }
        
        // Instagram rendering
        if (element.videoType === 'instagram') {
          const contentType = getInstagramContentType(element.videoUrl);
          const hasThumbnail = element.videoMeta?.thumbnail;
          
          return (
            <div
              className="w-full h-full rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (!wasDragging) {
                  window.open(element.videoUrl, '_blank');
                }
              }}
            >
              {hasThumbnail ? (
                // With thumbnail
                <div className="relative w-full h-full">
                  <img 
                    src={element.videoMeta.thumbnail} 
                    alt="Instagram" 
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  {/* Gradient overlay */}
                  <div 
                    className="absolute inset-0 flex flex-col items-center justify-center text-white p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(131, 58, 180, 0.75) 0%, rgba(193, 53, 132, 0.75) 50%, rgba(225, 48, 108, 0.75) 70%, rgba(253, 29, 29, 0.75) 85%, rgba(247, 119, 55, 0.75) 100%)'
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
                      className="mb-3 drop-shadow-lg"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none" />
                    </svg>
                    <p className="font-bold text-lg text-center drop-shadow-lg line-clamp-2">
                      {element.videoMeta.author || `Instagram ${contentType === 'reel' ? 'Reel' : 'Post'}`}
                    </p>
                    <p className="text-sm opacity-90 mt-1 drop-shadow-md">
                      Нажмите для просмотра
                    </p>
                  </div>
                </div>
              ) : (
                // Without thumbnail - gradient teaser
                <div 
                  className="w-full h-full flex flex-col items-center justify-center text-white p-6"
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
                    className="mb-4 drop-shadow-lg"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none" />
                  </svg>
                  <h3 className="font-bold text-xl mb-2 text-center drop-shadow-md">
                    Instagram {contentType === 'reel' ? 'Reel' : 'Post'}
                  </h3>
                  <p className="text-sm opacity-90 text-center drop-shadow-sm">
                    Нажмите для просмотра
                  </p>
                </div>
              )}
            </div>
          );
        }
        
        // YouTube rendering (only if videoType is not instagram)
        const videoId = extractYouTubeId(element.videoUrl);
        if (!videoId) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-sm">Некорректная ссылка видео</p>
            </div>
          );
        }
        
        if (element.displayMode === 'embed') {
          // Embedded player with drag overlay
          return (
            <div className="relative w-full h-full">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full rounded-lg"
                style={{
                  // CRITICAL FIX: Block pointer-events if NOT selected OR during drag
                  // This prevents iframe from capturing mouseUp events during drag operations
                  pointerEvents: (isSelected && !isDragging) ? 'auto' : 'none'
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video"
              />
              {/* Overlay to capture mouse events when iframe is blocked */}
              {(!isSelected || isDragging) && (
                <div 
                  className="absolute inset-0 cursor-move"
                  style={{ 
                    pointerEvents: 'auto',
                    zIndex: 10,
                    backgroundColor: 'transparent'
                  }}
                />
              )}
            </div>
          );
        } else {
          // Preview mode - open link ONLY when clicking WITHOUT drag
          // No iframe blocking needed here - preview uses thumbnail image
          return (
            <div
              className="w-full h-full bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
              style={{
                cursor: isDragging ? 'move' : 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Open ONLY if there was NO dragging
                if (!wasDragging) {
                  window.open(element.videoUrl, '_blank');
                }
              }}
            >
              {/* Thumbnail - takes remaining space */}
              <div className="relative flex-1 overflow-hidden bg-black">
                <img
                  src={element.videoMeta?.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt={element.videoMeta?.title || 'Video thumbnail'}
                  className="w-full h-full object-cover"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-all">
                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Info - fixed height at bottom */}
              <div className="p-3 flex-shrink-0 bg-white">
                <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                  {element.videoMeta?.title || 'YouTube Video'}
                </h3>
                <p className="text-xs text-gray-600">
                  {element.videoMeta?.author || 'YouTube'}
                </p>
              </div>
            </div>
          );
        }
      
      default:
        return null;
    }
  };

  return (
    <div
      ref={elementRef}
      className="cursor-move"
      style={{
        position: 'absolute',
        left: element.positionX,
        top: element.positionY,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        transform: `rotate(${element.rotation || 0}deg)`
      }}
      onMouseDown={handleDragStart}
      onMouseUp={(e) => {
        e.stopPropagation();
        if (isDraggingRef.current) {
          handleDragEnd();
        }
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Wrapper with relative for proper button positioning */}
      <div className={cn(
        'relative w-full h-full',
        isSelected && 'ring-2 ring-purple-500'
      )}>
        {renderContent()}

        {/* Selection controls */}
        {isSelected && (
          <>
            {/* Delete button - top-right corner */}
            <Button
              variant="destructive"
              size="sm"
              className="absolute w-7 h-7 p-0 rounded-full z-20 shadow-lg"
              style={{
                top: BUTTON_CORNER_OFFSET,
                right: BUTTON_CORNER_OFFSET
              }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            {/* Resize handle - bottom-right corner */}
            <div
              className="absolute w-6 h-6 bg-purple-500 rounded-full cursor-se-resize z-10 flex items-center justify-center shadow-lg border-2 border-white"
              style={{
                bottom: BUTTON_CORNER_OFFSET,
                right: BUTTON_CORNER_OFFSET
              }}
              onMouseDown={handleResizeStart}
            >
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21L12 21M21 21L21 12M21 21L14 14" />
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
