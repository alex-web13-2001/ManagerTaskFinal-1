import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface UIContextType {
  isDraggingRef: React.MutableRefObject<boolean>;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDraggingState] = useState(false);
  const isDraggingRef = useRef(false);

  const setIsDragging = useCallback((value: boolean) => {
    isDraggingRef.current = value;
    setIsDraggingState(value);
    console.log('[UIContext] Drag state:', value);
  }, []);

  const value: UIContextType = {
    isDraggingRef,
    isDragging,
    setIsDragging,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
