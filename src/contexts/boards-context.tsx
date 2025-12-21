import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { boardsAPI } from '../utils/api-client';
import { Board } from '../types';
import { toast } from 'sonner';
import { useAuth } from './auth-context';

interface BoardsContextType {
  boards: Board[];
  loading: boolean;
  error: string | null;
  fetchBoards: () => Promise<void>;
  createBoard: (data: { name: string; description?: string; color?: string }) => Promise<Board>;
  updateBoard: (id: string, data: { name?: string; description?: string; color?: string }) => Promise<Board>;
  deleteBoard: (id: string) => Promise<void>;
}

const BoardsContext = createContext<BoardsContextType | undefined>(undefined);

export function BoardsProvider({ children }: { children: React.ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchBoards = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    try {
      const fetchedBoards = await boardsAPI.getAll();
      setBoards(fetchedBoards);
    } catch (err: any) {
      console.error('Failed to fetch boards:', err);
      setError(err.message || 'Не удалось загрузить доски');
      toast.error('Не удалось загрузить доски');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const createBoard = useCallback(async (data: { name: string; description?: string; color?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const newBoard = await boardsAPI.create(data);
      setBoards((prev) => [newBoard, ...prev]);
      toast.success('Доска создана');
      return newBoard;
    } catch (err: any) {
      console.error('Failed to create board:', err);
      setError(err.message || 'Не удалось создать доску');
      toast.error('Не удалось создать доску');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBoard = useCallback(async (id: string, data: { name?: string; description?: string; color?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const updatedBoard = await boardsAPI.update(id, data);
      setBoards((prev) =>
        prev.map((board) => (board.id === id ? updatedBoard : board))
      );
      toast.success('Доска обновлена');
      return updatedBoard;
    } catch (err: any) {
      console.error('Failed to update board:', err);
      setError(err.message || 'Не удалось обновить доску');
      toast.error('Не удалось обновить доску');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBoard = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await boardsAPI.delete(id);
      setBoards((prev) => prev.filter((board) => board.id !== id));
      toast.success('Доска удалена');
    } catch (err: any) {
      console.error('Failed to delete board:', err);
      setError(err.message || 'Не удалось удалить доску');
      toast.error('Не удалось удалить доску');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch boards on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchBoards();
    }
  }, [isAuthenticated, fetchBoards]);

  const value = {
    boards,
    loading,
    error,
    fetchBoards,
    createBoard,
    updateBoard,
    deleteBoard,
  };

  return (
    <BoardsContext.Provider value={value}>
      {children}
    </BoardsContext.Provider>
  );
}

export function useBoards() {
  const context = useContext(BoardsContext);
  if (context === undefined) {
    throw new Error('useBoards must be used within a BoardsProvider');
  }
  return context;
}
