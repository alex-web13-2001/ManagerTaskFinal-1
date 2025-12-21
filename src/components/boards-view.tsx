import React from 'react';
import { Plus, Search, MoreVertical, Loader2, Pencil, Trash2, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader } from './ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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
import { BoardModal } from './board-modal';
import { useBoards } from '../contexts/boards-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface BoardsViewProps {
  onBoardClick?: (boardId: string) => void;
}

export function BoardsView({ onBoardClick }: BoardsViewProps) {
  const { boards, loading, deleteBoard } = useBoards();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [editingBoard, setEditingBoard] = React.useState<string | null>(null);
  const [boardToDelete, setBoardToDelete] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  // Filter boards by search query
  const filteredBoards = React.useMemo(() => {
    if (!searchQuery.trim()) return boards;
    
    const query = searchQuery.toLowerCase();
    return boards.filter((board) =>
      board.name.toLowerCase().includes(query) ||
      board.description?.toLowerCase().includes(query)
    );
  }, [boards, searchQuery]);

  const handleDeleteBoard = async (boardId: string) => {
    setActionLoading(boardId);
    try {
      await deleteBoard(boardId);
      setBoardToDelete(null);
    } catch (error) {
      console.error('Failed to delete board:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenBoard = (boardId: string) => {
    if (onBoardClick) {
      onBoardClick(boardId);
    }
  };

  if (loading && boards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-spin" />
          <p className="text-gray-600">Загрузка досок...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="flex-none px-6 py-4 bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Мои доски
              </h1>
              <p className="text-sm text-gray-600">
                {filteredBoards.length} {filteredBoards.length === 1 ? 'доска' : filteredBoards.length < 5 ? 'доски' : 'досок'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Поиск досок..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать доску
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-6 bg-white/50 rounded-full mb-6">
              <LayoutDashboard className="w-16 h-16 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchQuery ? 'Доски не найдены' : 'У вас пока нет досок'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              {searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Создайте свою первую доску для визуализации идей и заметок'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать первую доску
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBoards.map((board) => (
              <Card
                key={board.id}
                className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-purple-300"
                onClick={() => handleOpenBoard(board.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div
                        className="w-full h-24 rounded-lg mb-3 relative overflow-hidden"
                        style={{ backgroundColor: board.color }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate mb-1">
                        {board.name}
                      </h3>
                      {board.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {board.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBoard(board.id);
                          }}
                        >
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          Открыть
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBoard(board.id);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Переименовать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setBoardToDelete(board.id);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-gray-400">
                    Обновлено {format(new Date(board.updatedAt), 'd MMM yyyy', { locale: ru })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Board Modal */}
      <BoardModal
        open={isCreateModalOpen || editingBoard !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setEditingBoard(null);
          }
        }}
        mode={editingBoard ? 'edit' : 'create'}
        boardId={editingBoard || undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={boardToDelete !== null} onOpenChange={(open) => !open && setBoardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить доску?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Доска и все её элементы будут удалены навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading !== null}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => boardToDelete && handleDeleteBoard(boardToDelete)}
              disabled={actionLoading !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading === boardToDelete && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
