import React from 'react';
import { Plus, MoreHorizontal, Tag, Trash2, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '../contexts/auth-context';
import { useTasks } from '../contexts/tasks-context';

const AVAILABLE_COLORS = [
  'bg-purple-500',
  'bg-pink-500',
  'bg-green-500',
  'bg-blue-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-indigo-500',
];

export function CategoriesView() {
  const { categories, createCategory, updateCategory, deleteCategory } = useAuth();
  const { tasks } = useTasks();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<any>(null);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [newCategoryDescription, setNewCategoryDescription] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState(AVAILABLE_COLORS[0]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await createCategory({
        name: newCategoryName,
        color: selectedColor,
        description: newCategoryDescription,
      });
      
      setIsCreateOpen(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setSelectedColor(AVAILABLE_COLORS[0]);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !newCategoryName.trim()) return;

    try {
      await updateCategory(editingCategory.id, {
        name: newCategoryName,
        color: selectedColor,
        description: newCategoryDescription,
      });
      
      setIsEditOpen(false);
      setEditingCategory(null);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setSelectedColor(AVAILABLE_COLORS[0]);
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту категорию?')) {
      try {
        await deleteCategory(categoryId);
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const openEditDialog = (category: any) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryDescription(category.description || '');
    setSelectedColor(category.color);
    setIsEditOpen(true);
  };

  // Calculate task count for each category
  const getCategoryTaskCount = (categoryId: string) => {
    return tasks.filter(task => task.categoryId === categoryId).length;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-900 mb-1">Категории</h1>
            <p className="text-gray-600">Управление категориями задач</p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать категорию
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Tag className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-gray-900 mb-2">Нет категорий</h3>
            <p className="text-gray-600 mb-6">Создайте первую категорию для группировки задач</p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать категорию
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((category) => (
              <Card key={category.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center mb-3`}>
                      <Tag className="w-5 h-5 text-white" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(category)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h4>{category.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{category.description || 'Без описания'}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Задач:</span>
                    <Badge variant="secondary">
                      {getCategoryTaskCount(category.id)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать категорию</DialogTitle>
            <DialogDescription>
              Добавьте новую категорию для группировки задач
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Название категории</Label>
              <Input
                id="category-name"
                placeholder="Введите название"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Описание</Label>
              <Input
                id="category-description"
                placeholder="Краткое описание"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex gap-2 flex-wrap">
                {AVAILABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 ${color} rounded-md border-2 transition-colors ${
                      selectedColor === color ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2' : 'border-transparent hover:border-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewCategoryName('');
                  setNewCategoryDescription('');
                  setSelectedColor(AVAILABLE_COLORS[0]);
                }}
                className="flex-1"
              >
                Отмена
              </Button>
              <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700">
                Создать
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать категорию</DialogTitle>
            <DialogDescription>
              Измените название, описание или цвет категории
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCategory} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Название категории</Label>
              <Input
                id="edit-category-name"
                placeholder="Введите название"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-description">Описание</Label>
              <Input
                id="edit-category-description"
                placeholder="Краткое описание"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex gap-2 flex-wrap">
                {AVAILABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 ${color} rounded-md border-2 transition-colors ${
                      selectedColor === color ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2' : 'border-transparent hover:border-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingCategory(null);
                  setNewCategoryName('');
                  setNewCategoryDescription('');
                  setSelectedColor(AVAILABLE_COLORS[0]);
                }}
                className="flex-1"
              >
                Отмена
              </Button>
              <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700">
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
