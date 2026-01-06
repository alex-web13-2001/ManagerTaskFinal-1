
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { boardsAPI } from '../utils/api-client';
import { BoardCanvas } from './board-canvas';
import { Board, BoardElement } from '../types';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

export function PublicBoardView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = React.useState<(Board & { elements: BoardElement[] }) | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchBoard = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        const data = await boardsAPI.getPublic(token);
        setBoard(data);
      } catch (err: any) {
        console.error('Failed to load public board:', err);
        setError('Не удалось загрузить доску. Возможно, ссылка недействительна или доступ был закрыт.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка доступа</h2>
          <p className="text-gray-600 mb-6">{error || 'Доска не найдена'}</p>
          <Button onClick={() => navigate('/login')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Вернуться на главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-100">
      <BoardCanvas 
        boardId={board.id} 
        onBack={() => navigate('/login')} 
        isReadOnly={true}
        initialBoard={board}
      />
    </div>
  );
}
