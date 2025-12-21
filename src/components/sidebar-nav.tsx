import React from 'react';
import { Home, CheckSquare, FolderKanban, Tag, ChevronLeft, ChevronRight, ChevronDown, LayoutDashboard } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from './ui/sidebar';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useProjects } from '../contexts/projects-context';
import { useTasks } from '../contexts/tasks-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { getColorForProject } from '../utils/colors';

type NavigationItem = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  view: string;
};

const navigationItems: NavigationItem[] = [
  { title: 'Дашборд', icon: Home, view: 'dashboard' },
  { title: 'Личные задачи', icon: CheckSquare, view: 'tasks' },
  { title: 'Проекты', icon: FolderKanban, view: 'projects' },
  { title: 'Мои доски', icon: LayoutDashboard, view: 'boards' },
  { title: 'Категории', icon: Tag, view: 'categories' },
];


export function SidebarNav({
  currentView,
  onViewChange,
  onLogout,
  onProjectClick,
}: {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  onProjectClick?: (projectId: string) => void;
}) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const [showAllProjects, setShowAllProjects] = React.useState(false);
  const [projectsExpanded, setProjectsExpanded] = React.useState(false);

  // Get last 5 projects sorted by recent activity (task updates)
  const recentProjects = React.useMemo(() => {
    // Create a map of project ID to last task update time
    const projectLastUpdate = new Map<string, Date>();
    
    projects.forEach(project => {
      // Find tasks for this project
      const projectTasks = tasks.filter(task => task.projectId === project.id);
      
      if (projectTasks.length > 0) {
        // Get the most recent task update
        const lastTaskUpdate = projectTasks.reduce((latest, task) => {
          const taskDate = new Date(task.updatedAt);
          return taskDate > latest ? taskDate : latest;
        }, new Date(0));
        
        projectLastUpdate.set(project.id, lastTaskUpdate);
      } else {
        // No tasks, use project's updatedAt or createdAt
        const projectDate = new Date(project.updatedAt || project.createdAt);
        projectLastUpdate.set(project.id, projectDate);
      }
    });
    
    // Sort projects by last update (newest first)
    const sorted = [...projects].sort((a, b) => {
      const dateA = projectLastUpdate.get(a.id) || new Date(0);
      const dateB = projectLastUpdate.get(b.id) || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sorted;
  }, [projects, tasks]);

  const displayedProjects = showAllProjects ? recentProjects : recentProjects.slice(0, 5);

  return (
    <Sidebar collapsible="icon" className="pt-16">
      <SidebarContent>
        <div className="flex flex-col h-full">
          <SidebarMenu className="px-2 py-2 flex-1">
            {navigationItems.map((item) => {
              // Special handling for Projects menu item with submenu
              if (item.view === 'projects') {
                return (
                  <Collapsible
                    key={item.view}
                    open={projectsExpanded}
                    onOpenChange={setProjectsExpanded}
                  >
                    <SidebarMenuItem>
                      <div className="flex items-center w-full gap-1">
                        {/* Main button - only navigates to projects page */}
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton
                                isActive={currentView === item.view}
                                onClick={() => onViewChange(item.view)}
                                className="flex-1"
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.title}</span>
                              </SidebarMenuButton>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
                              <p>{item.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        {/* Arrow - only expands/collapses the list */}
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                projectsExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {displayedProjects.map((project) => (
                            <SidebarMenuSubItem key={project.id}>
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <SidebarMenuSubButton
                                      onClick={() => {
                                        onProjectClick?.(project.id);
                                      }}
                                    >
                                      <div
                                        className={`w-3 h-3 rounded-full ${getColorForProject(
                                          project.color
                                        )}`}
                                      />
                                      <span className="truncate">{project.name}</span>
                                    </SidebarMenuSubButton>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
                                    <p>{project.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </SidebarMenuSubItem>
                          ))}
                          {recentProjects.length > 5 && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                onClick={() => setShowAllProjects(!showAllProjects)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <span className="text-xs">
                                  {showAllProjects ? 'Скрыть' : 'Показать все'}
                                </span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              }

              // Regular menu items
              return (
                <SidebarMenuItem key={item.view}>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={currentView === item.view}
                          onClick={() => onViewChange(item.view)}
                          className="w-full"
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
                        <p>{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          
          {/* Toggle Button */}
          <div className="px-2 py-2 border-t">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSidebar}
                    className="w-full group-data-[collapsible=icon]:justify-center"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <>
                        <ChevronLeft className="w-4 h-4" />
                        <span>Свернуть</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
                  <p>Развернуть</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
