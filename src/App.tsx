import './utils/dev-tools-config';
import React from 'react';
import './styles/globals.css';
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
import { InviteAcceptPage } from './components/invite-accept-page';
import { TaskModal } from './components/task-modal';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';
import { Toaster } from './components/ui/sonner';
import { authAPI } from './utils/api-client';
import { AppProvider } from './contexts/app-context';
import { WebSocketProvider } from './contexts/websocket-context';
import { ErrorBoundary } from './components/error-boundary';
import { Loader2 } from 'lucide-react';
import { DndProviderWrapper } from './components/dnd-provider-wrapper';
import { generateFaviconDataURL } from './components/favicon-svg';

type View = 'dashboard' | 'dashboard-calendar' | 'tasks' | 'projects' | 'project-calendar' | 'categories' | 'archive' | 'profile' | 'invite';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentView, setCurrentView] = React.useState<View>('dashboard');
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [currentProject, setCurrentProject] = React.useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);

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
        // Check if URL is an invite link
        const path = window.location.pathname;
        if (path.startsWith('/invite/')) {
          const invitationId = path.replace('/invite/', '');
          if (invitationId) {
            setCurrentView('invite');
            setIsLoading(false);
            return; // Don't check auth for invite page, it will handle its own
          }
        }

        const user = await authAPI.getCurrentUser();
        if (isMounted && user) {
          setIsAuthenticated(true);
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
  }, []);

  const handleLogin = React.useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      await authAPI.signOut();
      setIsAuthenticated(false);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  // These hooks must be declared BEFORE any conditional returns
  const handleProjectClick = React.useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentProject(projectId);
  }, []);

  const handleBackToProjects = React.useCallback(() => {
    setSelectedProjectId(null);
    setCurrentProject(''); // Clear current project
  }, []);

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

  const renderView = React.useCallback(() => {
    try {
      // Если выбран проект, показываем страницу проекта
      if (selectedProjectId && currentView === 'projects') {
        return <ProjectDetailView key={selectedProjectId} projectId={selectedProjectId} onBack={handleBackToProjects} onCalendarView={handleCalendarView} />;
      }

      // Если открыт календарь проекта
      if (selectedProjectId && currentView === 'project-calendar') {
        return <ProjectCalendarView key={`calendar-${selectedProjectId}`} projectId={selectedProjectId} onBack={handleBackFromCalendar} />;
      }

      switch (currentView) {
        case 'dashboard':
          return <DashboardView key="dashboard" onCalendarView={handleDashboardCalendarView} />;
        case 'dashboard-calendar':
          return <DashboardCalendarView key="dashboard-calendar" onBack={handleBackFromDashboardCalendar} />;
        case 'projects':
          return <ProjectsView key="projects" onProjectClick={handleProjectClick} />;
        case 'tasks':
          return <TasksView key="tasks" />;
        case 'categories':
          return <CategoriesView key="categories" />;
        case 'archive':
          return <ArchiveView key="archive" />;
        case 'profile':
          return <ProfileView key="profile" />;
        case 'invite':
          return <InviteAcceptPage key="invite" />;
        default:
          return <DashboardView key="dashboard-default" onCalendarView={handleDashboardCalendarView} />;
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
  }, [selectedProjectId, currentView, handleBackToProjects, handleProjectClick, handleCalendarView, handleBackFromCalendar, handleDashboardCalendarView, handleBackFromDashboardCalendar]);

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

  // Show invite page without authentication
  if (currentView === 'invite') {
    return (
      <ErrorBoundary>
        <AppProvider>
          <InviteAcceptPage />
          <Toaster richColors position="top-right" />
        </AppProvider>
      </ErrorBoundary>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <DndProviderWrapper>
        <AppProvider>
          <WebSocketProvider>
            <SidebarProvider>
              <Header
                onCreateTask={() => setIsCreateTaskOpen(true)}
                onNavigate={(view) => setCurrentView(view as View)}
                onLogout={handleLogout}
                currentProject={currentProject}
              />
              <SidebarNav
                currentView={currentView}
                onViewChange={(view) => setCurrentView(view as View)}
                onLogout={handleLogout}
              />
              <SidebarInset className="pt-16 h-screen overflow-hidden">
                {renderView()}
              </SidebarInset>
              <TaskModal
                open={isCreateTaskOpen}
                onOpenChange={setIsCreateTaskOpen}
                mode="create"
                initialProject={currentProject}
                onSave={() => {}}
              />
              <Toaster />
            </SidebarProvider>
          </WebSocketProvider>
        </AppProvider>
      </DndProviderWrapper>
    </ErrorBoundary>
  );
}

export default App;
