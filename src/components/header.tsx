import React from 'react';
import { Plus, Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { SidebarTrigger } from './ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useApp } from '../contexts/app-context';
import { invitationsAPI, getAuthToken } from '../utils/api-client';
import { toast } from 'sonner';
import { RealtimeIndicator } from './realtime-indicator';
import { Logo } from './logo';
import { InvitationsModal } from './invitations-modal';

type HeaderProps = {
  onCreateTask: () => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  currentProject?: string;
};

export function Header({ onCreateTask, onNavigate, onLogout, currentProject }: HeaderProps) {
  const { currentUser, refreshData, isRealtimeConnected, canCreateTask } = useApp();
  const [pendingInvitations, setPendingInvitations] = React.useState<any[]>([]);
  const [isInvitationsModalOpen, setIsInvitationsModalOpen] = React.useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Fetch pending invitations
  const fetchInvitations = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
        return;
      }
      
      const invitations = await invitationsAPI.getMyInvitations();
      setPendingInvitations(invitations || []);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  }, []);

  React.useEffect(() => {
    if (currentUser) {
      fetchInvitations();
      // Poll for new invitations every 30 seconds
      const interval = setInterval(fetchInvitations, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchInvitations]);

  const handleInvitationAccepted = async () => {
    await fetchInvitations();
    // FIX Problem #3: Refresh all data including tasks and projects after accepting invitation
    // This ensures invited members can see their assigned tasks immediately
    await refreshData(); // Refresh projects list and tasks
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b z-50 flex items-center px-4 md:px-6">
      {/* Мобильное меню */}
      <div className="md:hidden mr-3">
        <SidebarTrigger />
      </div>

      {/* Логотип */}
      <Logo 
        size="md" 
        onClick={() => onNavigate('dashboard')}
      />

      {/* Правая часть */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        {/* Real-time индикатор */}
        <RealtimeIndicator isConnected={isRealtimeConnected} />

        <Button
          onClick={onCreateTask}
          className="bg-purple-600 hover:bg-purple-700 h-9 md:h-10"
          size="sm"
          disabled={currentProject && !canCreateTask(currentProject)}
        >
          <Plus className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Новая задача</span>
        </Button>

        {/* Уведомления о приглашениях */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={() => setIsInvitationsModalOpen(true)}
        >
          <Bell className="w-5 h-5" />
          {pendingInvitations.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
              {pendingInvitations.length}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 md:h-10 md:w-10 rounded-full p-0">
              <Avatar className="h-8 w-8 md:h-10 md:w-10">
                {currentUser?.avatarUrl && (
                  <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                )}
                <AvatarFallback className="bg-purple-100 text-purple-600 text-sm">
                  {getInitials(currentUser?.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {currentUser && (
              <div className="flex flex-col space-y-1 p-2 border-b">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-gray-500">{currentUser.email}</p>
              </div>
            )}
            <DropdownMenuItem onClick={() => onNavigate('profile')}>
              Профиль
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('categories')}>
              Справочники
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('archive')}>
              Архив
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600">
              Выход
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Invitations Modal */}
      <InvitationsModal
        open={isInvitationsModalOpen}
        onOpenChange={setIsInvitationsModalOpen}
        onInvitationAccepted={handleInvitationAccepted}
      />
    </header>
  );
}
