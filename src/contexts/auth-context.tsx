import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authAPI, getAuthToken, userSettingsAPI, categoriesAPI } from '../utils/api-client';
import { User, CustomColumn, Category } from '../types';
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
  customColumns: CustomColumn[];
  categories: Category[];
  login: (email: string, password: string) => Promise<void | User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getUserIdFromToken: () => string | null;
  fetchCustomColumns: () => Promise<void>;
  saveCustomColumns: (columns: CustomColumn[]) => Promise<void>;
  fetchCategories: () => Promise<void>;
  createCategory: (categoryData: Partial<Category>) => Promise<Category>;
  updateCategory: (categoryId: string, updates: Partial<Category>) => Promise<Category>;
  deleteCategory: (categoryId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  const fetchCustomColumns = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }
      
      const columns = await userSettingsAPI.getCustomColumns();
      console.log('✅ Кастомные столбцы загружены из API:', {
        count: columns.length,
        columns,
      });
      setCustomColumns(columns);
    } catch (error: any) {
      console.error('❌ Ошибка загрузки кастомных столбцов из API:', error);
      // Try to load from localStorage as fallback
      const userId = getUserIdFromToken();
      if (userId) {
        const stored = localStorage.getItem(`personal-custom-columns-${userId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setCustomColumns(parsed);
            console.log('✅ Кастомные столбцы загружены из localStorage (fallback):', {
              count: parsed.length,
              columns: parsed,
            });
          } catch (e) {
            console.error('❌ Ошибка парсинга кастомных столбцов из localStorage:', e);
          }
        } else {
          console.log('ℹ️ Кастомные столбцы не найдены ни в API, ни в localStorage');
        }
      }
    }
  }, []);

  const saveCustomColumns = useCallback(async (columns: CustomColumn[]) => {
    try {
      await userSettingsAPI.saveCustomColumns(columns);
      setCustomColumns(columns);
      console.log('✅ Кастомные столбцы сохранены в API:', {
        count: columns.length,
        columns,
      });
      
      // Also save to localStorage as backup
      const userId = getUserIdFromToken();
      if (userId) {
        localStorage.setItem(`personal-custom-columns-${userId}`, JSON.stringify(columns));
        console.log('✅ Кастомные столбцы также сохранены в localStorage (backup)');
      }
    } catch (error: any) {
      console.error('❌ Ошибка сохранения кастомных столбцов в API:', error);
      // Save to localStorage as fallback
      const userId = getUserIdFromToken();
      if (userId) {
        localStorage.setItem(`personal-custom-columns-${userId}`, JSON.stringify(columns));
        setCustomColumns(columns);
        console.log('✅ Кастомные столбцы сохранены в localStorage (fallback):', {
          count: columns.length,
          columns,
        });
      }
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }
      
      const categoriesData = await categoriesAPI.getCategories();
      setCategories(categoriesData);
      console.log('✅ Категории загружены:', categoriesData.length);
    } catch (error: any) {
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки категорий:', error);
      }
    }
  }, []);

  const createCategory = useCallback(async (categoryData: Partial<Category>): Promise<Category> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      const userId = getUserIdFromToken();
      if (!userId) {
        throw new Error('Не удалось получить userId из токена');
      }
      
      const newCategory = {
        ...categoryData,
        id: categoryData.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setCategories((prevCategories) => {
        const updatedCategories = [...prevCategories, newCategory];
        categoriesAPI.saveCategories(updatedCategories).catch((error) => {
          console.error('❌ Ошибка сохранения категории в API:', error);
        });
        return updatedCategories;
      });

      console.log('✅ Категория создана:', newCategory);
      toast.success('Категория создана');
      return newCategory as Category;
    } catch (error: any) {
      console.error('❌ Ошибка создания категории:', error);
      toast.error(error.message || 'Ошибка создания категории');
      throw error;
    }
  }, []);

  const updateCategory = useCallback(async (categoryId: string, updates: Partial<Category>): Promise<Category> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      let updatedCategory: Category | undefined;
      
      setCategories((prevCategories) => {
        const updatedCategories = prevCategories.map(c => 
          c.id === categoryId 
            ? { ...c, ...updates, updatedAt: new Date().toISOString() }
            : c
        );
        
        updatedCategory = updatedCategories.find(c => c.id === categoryId);
        
        categoriesAPI.saveCategories(updatedCategories).catch((error) => {
          console.error('❌ Ошибка сохранения категории в API:', error);
        });
        
        return updatedCategories;
      });

      console.log('✅ Категория обновлена:', updatedCategory);
      toast.success('Категория обновлена');
      return updatedCategory!;
    } catch (error: any) {
      console.error('❌ Ошибка обновления категории:', error);
      toast.error(error.message || 'Ошибка обновления категории');
      throw error;
    }
  }, []);

  const deleteCategory = useCallback(async (categoryId: string): Promise<void> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      setCategories((prevCategories) => {
        const updatedCategories = prevCategories.filter(c => c.id !== categoryId);
        
        categoriesAPI.saveCategories(updatedCategories).catch((error) => {
          console.error('❌ Ошибка удаления категории в API:', error);
        });
        
        return updatedCategories;
      });

      console.log('✅ Категория удалена:', categoryId);
      toast.success('Категория удалена');
    } catch (error: any) {
      console.error('❌ Ошибка удаления категории:', error);
      toast.error(error.message || 'Ошибка удаления категории');
      throw error;
    }
  }, []);

  // Load custom columns and categories when user is loaded
  useEffect(() => {
    if (currentUser) {
      console.log('👤 User loaded, fetching custom columns and categories...');
      fetchCustomColumns();
      fetchCategories();
    }
  }, [currentUser?.id, fetchCustomColumns, fetchCategories]);

  const value: AuthContextType = {
    currentUser,
    isAuthenticated,
    isLoading,
    customColumns,
    categories,
    login,
    logout,
    updateUser,
    uploadAvatar,
    deleteAvatar,
    checkAuth,
    getUserIdFromToken,
    fetchCustomColumns,
    saveCustomColumns,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
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
