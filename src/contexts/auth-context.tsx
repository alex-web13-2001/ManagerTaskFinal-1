import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authAPI, getAuthToken } from '../utils/api-client';
import { User } from '../types';
import { toast } from 'sonner';

/**
 * Helper function to get user ID from JWT token
 */
const getUserIdFromToken = (): string | null => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.sub || null;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void | User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getUserIdFromToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = !!currentUser;

  const checkAuth = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const user = await authAPI.getCurrentUser();
      if (user) {
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name || user.user_metadata?.name || 'Пользователь',
          avatarUrl: user.avatarUrl || user.user_metadata?.avatarUrl,
          createdAt: user.createdAt || user.created_at,
        };
        setCurrentUser(userData);
        console.log('✅ Данные пользователя загружены:', {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        });
      }
    } catch (error: any) {
      console.error('❌ Ошибка загрузки данных пользователя:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string): Promise<void | User> => {
    try {
      const user = await authAPI.signIn(email, password);
      if (user) {
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name || user.user_metadata?.name || 'Пользователь',
          avatarUrl: user.avatarUrl || user.user_metadata?.avatarUrl,
          createdAt: user.createdAt || user.created_at,
        };
        setCurrentUser(userData);
        return userData;
      }
    } catch (error: any) {
      console.error('❌ Ошибка входа:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.signOut();
      setCurrentUser(null);
      console.log('✅ Пользователь вышел из системы');
    } catch (error: any) {
      console.error('❌ Ошибка выхода:', error);
      throw error;
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    try {
      if (!currentUser) {
        throw new Error('Необходима авторизация');
      }
      
      const updatedUser = await authAPI.updateUser(updates);
      
      if (updatedUser) {
        const userData = {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name || updatedUser.user_metadata?.name || 'Пользователь',
          avatarUrl: updatedUser.avatarUrl || updatedUser.user_metadata?.avatarUrl,
          createdAt: updatedUser.createdAt || updatedUser.created_at,
        };
        setCurrentUser(userData);
        console.log('✅ Данные пользователя обновлены');
        toast.success('Профиль обновлён');
      }
    } catch (error: any) {
      console.error('❌ Ошибка обновления пользователя:', error);
      toast.error(error.message || 'Ошибка обновления профиля');
      throw error;
    }
  }, [currentUser]);

  const uploadAvatar = useCallback(async (file: File) => {
    try {
      if (!currentUser) {
        throw new Error('Необходима авторизация');
      }
      
      const result = await authAPI.uploadAvatar(file);
      
      if (result?.avatarUrl) {
        setCurrentUser(prev => prev ? { ...prev, avatarUrl: result.avatarUrl } : null);
        console.log('✅ Аватар загружен');
        toast.success('Аватар обновлён');
      }
    } catch (error: any) {
      console.error('❌ Ошибка загрузки аватара:', error);
      toast.error(error.message || 'Ошибка загрузки аватара');
      throw error;
    }
  }, [currentUser]);

  const deleteAvatar = useCallback(async () => {
    try {
      if (!currentUser) {
        throw new Error('Необходима авторизация');
      }
      
      await authAPI.deleteAvatar();
      setCurrentUser(prev => prev ? { ...prev, avatarUrl: undefined } : null);
      console.log('✅ Аватар удалён');
      toast.success('Аватар удалён');
    } catch (error: any) {
      console.error('❌ Ошибка удаления аватара:', error);
      toast.error(error.message || 'Ошибка удаления аватара');
      throw error;
    }
  }, [currentUser]);

  const value: AuthContextType = {
    currentUser,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    uploadAvatar,
    deleteAvatar,
    checkAuth,
    getUserIdFromToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
