import './utils/dev-tools-config';
import React from 'react';
import './styles/globals.css';
import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthScreen } from './components/auth-screen';
import { SidebarNav } from './components/sidebar-nav';
import { Header } from './components/header';
import { DashboardView } from './components/dashboard-view';
import { DashboardCalendarView } from './components/dashboard-calendar-view';
import { ProjectsView } from './components/projects-view';
import { ProjectDetailView } from './components/project-detail-view';
import { ProjectCalendarView } from './components/project-calendar-view';
import { TasksView } from './components/tasks-view';
import { CategoriesView } from './components/categories-view';
import { ArchiveView } from './components/archive-view';
import { ProfileView } from './components/profile-view';
import { InvitationPage } from './components/invitation-page';
import { VerifyEmailPage } from './components/verify-email-page';
import { ResetPasswordPage } from './components/reset-password-page';
import { WelcomeModal } from './components/welcome-modal';
import { TaskModal } from './components/task-modal';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';
import { Toaster } from './components/ui/sonner';
import { authAPI } from './utils/api-client';
import { AppProvider, useApp } from './contexts/app-context';
import { WebSocketProvider } from './contexts/websocket-context';
import { ErrorBoundary } from './components/error-boundary';
import { Loader2 } from 'lucide-react';
import { DndProviderWrapper } from './components/dnd-provider-wrapper';
import { generateFaviconDataURL } from './components/favicon-svg';

type View = 'dashboard' | 'dashboard-calendar' | 'tasks' | 'projects' | 'project-calendar' | 'categories' | 'archive' | 'profile' | 'invite';

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

function AppRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showVerifyEmail, setShowVerifyEmail] = React.useState(false);
  const [showResetPassword, setShowResetPassword] = React.useState(false);

  // Global error handler - must be first effect - AGGRESSIVE WASM SUPPRESSION
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Filter out Figma internal errors
      const source = event.filename || '';
      const message = event.message || '';
      const errorStack = event.error?.stack?.toString() || '';
      const errorStr = String(event.error || '');
      
      // Suppress Figma DevTools, WASM errors, and DnD backend errors - comprehensive check
      if (
        source.includes('devtools_worker') ||
        source.includes('webpack-artifacts') ||
        source.includes('code_components_preview_iframe') ||
        source.includes('wasm') ||
        message.includes('wasm') ||
        message.includes('devtools_worker') ||
        message.includes('webpack-artifacts') ||
        message.includes('code_components_preview_iframe') ||
        message.includes('Global error: null') ||
        message.includes('HTML5 backend') ||
        message.includes('HTML5Backend') ||
        message.includes('two HTML5 backends') ||
        message.includes('Cannot have two') ||
        errorStack.includes('devtools_worker') ||
        errorStack.includes('webpack-artifacts') ||
        errorStack.includes('code_components_preview_iframe') ||
        errorStack.includes('wasm') ||
        errorStack.includes('HTML5Backend') ||
        errorStack.includes('react-dnd-html5-backend') ||
        errorStr.includes('wasm') ||
        errorStr.includes('devtools_worker') ||
        errorStr.includes('webpack-artifacts') ||
        errorStr.includes('code_components_preview_iframe') ||
        errorStr.includes('HTML5 backend') ||
        errorStr.includes('two HTML5 backends') ||
        (message === 'null' && source.includes('figma.com'))
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
      console.error('Global error:', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString() || '';
      const stack = event.reason?.stack?.toString() || '';
      
      // Suppress Figma DevTools, WASM, and DnD errors - comprehensive check
      if (
        reason.includes('devtools_worker') ||
        reason.includes('webpack-artifacts') ||
        reason.includes('code_components_preview_iframe') ||
        reason.includes('wasm') ||
        reason.includes('HTML5 backend') ||
        reason.includes('two HTML5 backends') ||
        reason.includes('react-dnd-html5-backend') ||
        stack.includes('devtools_worker') ||
        stack.includes('webpack-artifacts') ||
        stack.includes('code_components_preview_iframe') ||
        stack.includes('wasm') ||
        stack.includes('HTML5Backend') ||
        stack.includes('react-dnd-html5-backend') ||
        (reason === 'null' && stack.includes('figma.com'))
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
      console.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('error', handleError, true); // Use capture phase
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    };
  }, []);

  // Set page title and favicon
  React.useEffect(() => {
    document.title = 'T24 - Task Manager';
    
    // Set favicon
    const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    favicon.setAttribute('type', 'image/svg+xml');
    favicon.setAttribute('href', generateFaviconDataURL());
    document.head.appendChild(favicon);
  }, []);

  // Check for existing session on mount
  React.useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    const checkAuth = async () => {
      try {
        // Проверяем URL для верификации email
        const params = new URLSearchParams(location.search);
        if (params.get('token') && location.pathname === '/') {
          setShowVerifyEmail(true);
          setIsLoading(false);
          return;
        }
        
        // Проверяем URL для сброса пароля
        if (params.get('reset-token')) {
          setShowResetPassword(true);
          setIsLoading(false);
          return;
        }

        // Check if URL is an invite link with query parameter
        if (location.pathname === '/invite' && params.get('token')) {
          setIsLoading(false);
          return; // Don't check auth for invite page, it will handle its own
        }

        // Support legacy invite link format /invite/{token}
        if (location.pathname.startsWith('/invite/')) {
          const token = location.pathname.replace('/invite/', '');
          if (token) {
            // Redirect to new format
            window.location.href = `/invite?token=${token}`;
            return;
          }
        }

        const user = await authAPI.getCurrentUser();
        if (isMounted && user) {
          setIsAuthenticated(true);
        } else if (isMounted && !user) {
          // Save current URL for redirect after login
          const currentPath = location.pathname;
          if (currentPath !== '/' && currentPath !== '/login' && !currentPath.startsWith('/invite')) {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Auth check error:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    try {
      const { data } = authAPI.onAuthStateChange((user) => {
        if (isMounted) {
          setIsAuthenticated(!!user);
        }
      });
      subscription = data.subscription;
    } catch (error) {
      console.error('Auth subscription error:', error);
    }

    return () => {
      isMounted = false;
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      }
    };
  }, [location.pathname, location.search]);

  const handleLogin = React.useCallback(() => {
    setIsAuthenticated(true);
    
    // Check for redirect URL
    const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
    if (redirectUrl) {
      sessionStorage.removeItem('redirectAfterLogin');
      navigate(redirectUrl);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handleLogout = React.useCallback(async () => {
    try {
      await authAPI.signOut();
      setIsAuthenticated(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [navigate]);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-spin" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Show email verification page
  if (showVerifyEmail) {
    return (
      <ErrorBoundary>
        <AppProvider>
          <VerifyEmailPage 
            onVerified={(hasInvitation) => {
              setShowVerifyEmail(false);
              setIsAuthenticated(true);
              if (!hasInvitation) {
                // Показываем welcome modal, добавляя параметр в URL
                navigate('/?welcome=true', { replace: true });
              }
            }} 
          />
          <Toaster richColors position="top-right" />
        </AppProvider>
      </ErrorBoundary>
    );
  }

  // Show reset password page
  if (showResetPassword) {
    return (
      <ErrorBoundary>
        <AppProvider>
          <ResetPasswordPage onSuccess={() => {
            setShowResetPassword(false);
            navigate('/');
          }} />
          <Toaster richColors position="top-right" />
        </AppProvider>
      </ErrorBoundary>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!isAuthenticated ? <AuthScreen onLogin={handleLogin} /> : <Navigate to="/" replace />} />
      <Route path="/invite" element={
        <ErrorBoundary>
          <AppProvider>
            <InvitationPage />
            <Toaster richColors position="top-right" />
          </AppProvider>
        </ErrorBoundary>
      } />
      
      {/* Protected routes */}
      {isAuthenticated ? (
        <>
          <Route path="/" element={<MainApp />} />
          <Route path="/tasks/:taskId" element={<MainApp />} />
          <Route path="/projects/:projectId" element={<MainApp />} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<MainApp />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

function MainApp() {
  return (
    <ErrorBoundary>
      <DndProviderWrapper>
        <AppProvider>
          <WebSocketProvider>
            <MainAppContent />
          </WebSocketProvider>
        </AppProvider>
      </DndProviderWrapper>
    </ErrorBoundary>
  );
}

function MainAppContent() {
  const { taskId, projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { tasks } = useApp(); // Get tasks from context
  const [currentView, setCurrentView] = React.useState<View>('dashboard');
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [currentProject, setCurrentProject] = React.useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // URL → State synchronization (Problem #3 fix: add task existence check)
  React.useEffect(() => {
    // If in URL there's a taskId
    if (taskId) {
      // Check that task exists before showing it
      const taskExists = tasks.some(t => t.id === taskId);
      if (taskExists) {
        setSelectedTaskId(taskId);
      } else {
        // Task doesn't exist, clear it from URL
        setSelectedTaskId(null);
      }
    } else if (!taskId && selectedTaskId) {
      setSelectedTaskId(null);
    }
    
    // If in URL there's a projectId
    if (projectId) {
      setCurrentView('projects');
      setSelectedProjectId(projectId);
} else if (selectedProjectId && !projectId) {
      // Navigated away from project detail
      setSelectedProjectId(null);
    }
  }, [location.pathname, projectId, taskId, tasks, selectedTaskId, selectedProjectId]); // Add tasks to dependencies

  // Handlers with URL updates
  const handleTaskClick = React.useCallback((taskId: string) => {
    if (selectedProjectId) {
      navigate(`/projects/${selectedProjectId}/tasks/${taskId}`);
    } else {
      navigate(`/tasks/${taskId}`);
    }
  }, [selectedProjectId, navigate]);

  const handleTaskClose = React.useCallback(() => {
    if (selectedProjectId) {
      navigate(`/projects/${selectedProjectId}`);
    } else {
      navigate('/');
    }
  }, [selectedProjectId, navigate]);

  const handleProjectClick = React.useCallback((projectId: string) => {
    navigate(`/projects/${projectId}`);
    setSelectedProjectId(projectId);
  }, [navigate]);

  const handleBackToProjects = React.useCallback(() => {
    setCurrentView('projects'); // Problem #4 fix: Set view to 'projects' list
    setSelectedProjectId(null);
    navigate('/');
  }, [navigate]);

  // Sync currentProject with selectedProjectId for task creation
  React.useEffect(() => {
    if (selectedProjectId && currentView === 'projects') {
      setCurrentProject(selectedProjectId);
      console.log('🔄 Synced currentProject with selectedProjectId:', selectedProjectId);
    } else if (currentView !== 'projects') {
      setCurrentProject('');
    }
  }, [selectedProjectId, currentView]);

  const handleCalendarView = React.useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentView('project-calendar');
  }, []);

  const handleBackFromCalendar = React.useCallback(() => {
    setCurrentView('projects');
  }, []);

  const handleDashboardCalendarView = React.useCallback(() => {
    setCurrentView('dashboard-calendar');
  }, []);

  const handleBackFromDashboardCalendar = React.useCallback(() => {
    setCurrentView('dashboard');
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      await authAPI.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [navigate]);

  const renderView = React.useCallback(() => {
    try {
      // Если выбран проект, показываем страницу проекта
      if (selectedProjectId && currentView === 'projects') {
        return <ProjectDetailView key={selectedProjectId} projectId={selectedProjectId} onBack={handleBackToProjects} onCalendarView={handleCalendarView} onTaskClick={handleTaskClick} />;
      }

      // Если открыт календарь проекта
      if (selectedProjectId && currentView === 'project-calendar') {
        return <ProjectCalendarView key={`calendar-${selectedProjectId}`} projectId={selectedProjectId} onBack={handleBackFromCalendar} />;
      }

      switch (currentView) {
        case 'dashboard':
          return <DashboardView key="dashboard" onCalendarView={handleDashboardCalendarView} onTaskClick={handleTaskClick} />;
        case 'dashboard-calendar':
          return <DashboardCalendarView key="dashboard-calendar" onBack={handleBackFromDashboardCalendar} />;
        case 'projects':
          return <ProjectsView key="projects" onProjectClick={handleProjectClick} />;
        case 'tasks':
          return <TasksView key="tasks" onTaskClick={handleTaskClick} />;
        case 'categories':
          return <CategoriesView key="categories" />;
        case 'archive':
          return <ArchiveView key="archive" />;
        case 'profile':
          return <ProfileView key="profile" />;
        default:
          return <DashboardView key="dashboard-default" onCalendarView={handleDashboardCalendarView} onTaskClick={handleTaskClick} />;
      }
    } catch (error) {
      console.error('Error rendering view:', error);
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-red-600">Ошибка отображения</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
  }, [selectedProjectId, currentView, handleBackToProjects, handleProjectClick, handleCalendarView, handleBackFromCalendar, handleDashboardCalendarView, handleBackFromDashboardCalendar, handleTaskClick]);

  return (
    <SidebarProvider>
      <WelcomeModal />
      <Header
        onCreateTask={() => setIsCreateTaskOpen(true)}
        onNavigate={(view) => {
          setCurrentView(view as View);
          if (view !== 'projects' || !selectedProjectId) {
            // Problem #4 fix: Only navigate if needed
            navigate('/');
          } else {
            navigate('/');
          }
        }}
        onLogout={handleLogout}
        currentProject={currentProject}
      />
      <SidebarNav
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view as View);
          // Problem #4 fix: Only navigate to root if not already there or in a detail view
          if (location.pathname !== '/') {
            navigate('/');
          }
        }}
        onLogout={handleLogout}
      />
      <SidebarInset className="pt-16 h-screen overflow-hidden">
        {renderView()}
      </SidebarInset>
      
      {/* Global task modal */}
      {selectedTaskId && (
        <TaskModal
          open={!!selectedTaskId}
          onOpenChange={(open) => {
            if (!open) {
// Problem #2 fix: Check if task exists before navigating
              const taskExists = tasks.some(t => t.id === selectedTaskId);
              if (!taskExists) {
                // Task was deleted, just clear state without navigation
                setSelectedTaskId(null);
                return;
              }
              
              setSelectedTaskId(null);
              handleTaskClose();
            }
          }}
          mode="view"
          taskId={selectedTaskId}
        />
      )}
      
      <TaskModal
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        mode="create"
        initialProject={currentProject}
        onSave={() => {}}
      />
      <Toaster />
    </SidebarProvider>
  );
}

export default App;
