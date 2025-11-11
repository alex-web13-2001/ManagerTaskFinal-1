// Этот файл сообщает TypeScript, что мы добавляем новые свойства к стандартному объекту Request.
declare namespace Express {
  export interface Request {
    user?: {
      sub: string; // ID пользователя из токена
      email: string;
      roleInProject?: 'owner' | 'admin' | 'collaborator' | 'member' | 'viewer' | null;
    };
  }
}
