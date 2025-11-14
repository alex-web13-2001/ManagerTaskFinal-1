import TelegramBot from 'node-telegram-bot-api';
import prisma from './db';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let bot: TelegramBot | null = null;

/**
 * Initialize Telegram bot
 */
export function initializeTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set. Telegram bot is disabled.');
    return;
  }

  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    
    // Command /start
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await bot!.sendMessage(chatId, 
        '👋 Привет! Я T24 Бот - твой помощник по задачам.\n\n' +
        '🔗 Для подключения:\n' +
        '1. Зайди в веб-приложение T24\n' +
        '2. Нажми на кнопку "Т24 Бот"\n' +
        '3. Скопируй код подключения\n' +
        '4. Отправь его мне\n\n' +
        '✉️ Используй команду /help для справки'
      );
    });
    
    // Command /help
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await bot!.sendMessage(chatId,
        '📚 Доступные команды:\n\n' +
        '/start - Начать работу с ботом\n' +
        '/link - Получить инструкцию по подключению\n' +
        '/unlink - Отвязать аккаунт\n' +
        '/help - Показать эту справку'
      );
    });

    // Command /link
    bot.onText(/\/link/, async (msg) => {
      const chatId = msg.chat.id;
      await bot!.sendMessage(chatId,
        '🔗 Как подключить аккаунт:\n\n' +
        '1. Откройте веб-приложение T24\n' +
        '2. Нажмите на кнопку "Т24 Бот" в правом верхнем углу\n' +
        '3. Скопируйте код подключения (формат: LINK-XXX)\n' +
        '4. Отправьте мне этот код'
      );
    });

    // Command /unlink
    bot.onText(/\/unlink/, async (msg) => {
      const chatId = msg.chat.id;
      
      try {
        // Find user by chat ID and unlink
        const user = await prisma.user.findUnique({
          where: { telegramChatId: chatId.toString() },
        });

        if (!user) {
          await bot!.sendMessage(chatId, '❌ Ваш аккаунт не привязан.');
          return;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            telegramChatId: null,
            telegramUsername: null,
            telegramLinkedAt: null,
          },
        });

        await bot!.sendMessage(chatId, '✅ Аккаунт успешно отвязан.');
      } catch (error) {
        console.error('Unlink error:', error);
        await bot!.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
      }
    });
    
    // Handle link token messages (format: LINK-xxx)
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();
      
      if (!text || text.startsWith('/')) return;
      
      // Check for link token format: LINK-XXX (6 chars)
      if (text.match(/^LINK-[A-Z0-9]{6}$/i)) {
        await handleLinkToken(chatId, text.toUpperCase(), msg.from?.username);
      }
    });
    
    console.log('🤖 Telegram bot initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
  }
}

/**
 * Handle token linking
 */
async function handleLinkToken(chatId: number, token: string, username?: string) {
  try {
    // Find token in database
    const linkToken = await prisma.telegramLinkToken.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!linkToken) {
      await bot!.sendMessage(chatId, '❌ Неверный код. Проверьте правильность ввода.');
      return;
    }
    
    // Check expiration
    if (linkToken.expiresAt < new Date()) {
      await bot!.sendMessage(chatId, '⏰ Код истёк. Получите новый код в веб-приложении.');
      await prisma.telegramLinkToken.delete({ where: { id: linkToken.id } });
      return;
    }
    
    // Link account
    await prisma.user.update({
      where: { id: linkToken.userId },
      data: {
        telegramChatId: chatId.toString(),
        telegramUsername: username,
        telegramLinkedAt: new Date(),
      },
    });
    
    // Delete used token
    await prisma.telegramLinkToken.delete({ where: { id: linkToken.id } });
    
    await bot!.sendMessage(
      chatId,
      `✅ Аккаунт успешно привязан!\n\n` +
      `👤 Пользователь: ${linkToken.user.name}\n` +
      `📧 Email: ${linkToken.user.email}\n\n` +
      `Теперь вы будете получать уведомления о назначенных задачах.`
    );
  } catch (error) {
    console.error('Telegram link error:', error);
    await bot!.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Send notification about task assignment
 */
export async function sendTaskAssignedNotification(
  userId: string,
  task: {
    id: string;
    title: string;
    description?: string;
    priority: string;
    projectName?: string;
    assignerName: string;
  }
) {
  if (!bot) {
    console.log('⚠️  Telegram bot not initialized, skipping notification');
    return;
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });
    
    if (!user?.telegramChatId) {
      console.log(`ℹ️  User ${userId} has no Telegram linked, skipping notification`);
      return;
    }
    
    const priorityEmoji: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      urgent: '🚨',
    };
    
    const emoji = priorityEmoji[task.priority] || '⚪';
    
    const message =
      `${emoji} Вам назначена новая задача!\n\n` +
      `📋 ${task.title}\n` +
      (task.description ? `📝 ${task.description.slice(0, 100)}${task.description.length > 100 ? '...' : ''}\n\n` : '\n') +
      (task.projectName ? `📁 Проект: ${task.projectName}\n` : '') +
      `👤 От: ${task.assignerName}\n` +
      `⏰ Приоритет: ${task.priority}\n\n` +
      `🔗 Открыть: ${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173'}/tasks`;
    
    await bot.sendMessage(user.telegramChatId, message);
    console.log(`📤 Telegram notification sent to user ${userId}`);
  } catch (error) {
    console.error('Send Telegram notification error:', error);
  }
}

/**
 * Get Telegram bot instance
 */
export function getTelegramBot() {
  return bot;
}
