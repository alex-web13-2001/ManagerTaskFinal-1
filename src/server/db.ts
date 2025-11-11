// Этот файл создает и экспортирует единственный экземпляр PrismaClient для всего приложения.
// This file creates and exports a single PrismaClient instance for the entire application.

import { PrismaClient } from '@prisma/client';

// Объявляем глобальную переменную для хранения клиента
// Declare a global variable to store the client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Создаем или используем существующий экземпляр Prisma
// Create or use existing Prisma instance
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// В режиме разработки сохраняем экземпляр в глобальной переменной
// In development mode, save the instance to the global variable
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Экспортируем по умолчанию для совместимости
// Export as default for compatibility
export default prisma;
