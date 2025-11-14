import React from 'react';
import { Archive, RotateCcw, Trash2, Users, CalendarDays } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { useApp } from '../contexts/app-context';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function ArchiveView() {
  const { archivedProjects, fetchArchivedProjects, restoreProject, deleteProject } = useApp();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null);

  // Load archived projects on mount
  React.useEffect(() => {
    fetchArchivedProjects();
  }, [fetchArchivedProjects]);

  const filteredProjects = React.useMemo(() => {
    if (!searchQuery) return archivedProjects;
    return archivedProjects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, archivedProjects]);

  const handleRestore = async (projectId: string) => {
    try {
      await restoreProject(projectId);
    } catch (error) {
      console.error('Error restoring project:', error);
    }
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    
    try {
      await deleteProject(projectToDelete);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-500',
      green: 'bg-green-500',
      orange: 'bg-orange-500',
      pink: 'bg-pink-500',
      blue: 'bg-blue-500',
      red: 'bg-red-500',
    };
    return color ? colorMap[color] || 'bg-gray-500' : 'bg-gray-500';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-gray-900 mb-1">Архив</h1>
            <p className="text-gray-600">Архивированные проекты</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Поиск в архиве..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Archive className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 mb-2">Архив пуст</h3>
            <p className="text-gray-600 max-w-md">
              Архивированные проекты будут отображаться здесь
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getColorClass(project.color)} flex-shrink-0`} />
                        <h4 className="truncate">{project.name}</h4>
                        {project.category && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            {project.category}
                          </Badge>
                        )}
                      </div>
                      
                      {project.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {project.members && project.members.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>{project.members.length} участников</span>
                          </div>
                        )}
                        {project.archivedAt && (
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4" />
                            <span>Архивировано: {formatDate(project.archivedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRestore(project.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Восстановить
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setProjectToDelete(project.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Проект и все его задачи будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
