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
    
    // Handle callback queries (inline button clicks)
    bot.on('callback_query', async (query) => {
      await handleCallbackQuery(query);
    });
    
    console.log('🤖 Telegram bot initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
  }
}

/**
 * Handle callback queries from inline keyboards
 */
async function handleCallbackQuery(query: TelegramBot.CallbackQuery) {
  if (!bot || !query.message) return;
  
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  if (!data) return;
  
  try {
    // Handle invitation responses (accept/decline)
    if (data.startsWith('accept_') || data.startsWith('decline_')) {
      const action = data.startsWith('accept_') ? 'accept' : 'decline';
      const token = data.substring(action === 'accept' ? 7 : 8); // Remove "accept_" or "decline_"
      
      // Find the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: {
          project: true,
          invitedByUser: {
            select: { name: true },
          },
        },
      });
      
      if (!invitation) {
        await bot!.answerCallbackQuery(query.id, {
          text: '❌ Приглашение не найдено',
          show_alert: true,
        });
        return;
      }
      
      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        await bot!.answerCallbackQuery(query.id, {
          text: '⚠️ Приглашение уже обработано',
          show_alert: true,
        });
        return;
      }
      
      // Find user by telegram chat ID
      const user = await prisma.user.findUnique({
        where: { telegramChatId: chatId.toString() },
      });
      
      if (!user) {
        await bot!.answerCallbackQuery(query.id, {
          text: '❌ Аккаунт не привязан к Telegram',
          show_alert: true,
        });
        return;
      }
      
      // Check if user email matches invitation email
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        await bot!.answerCallbackQuery(query.id, {
          text: '❌ Это приглашение для другого пользователя',
          show_alert: true,
        });
        return;
      }
      
      if (action === 'accept') {
        // Check if user is already a member
        const existingMember = await prisma.projectMember.findUnique({
          where: {
            userId_projectId: {
              userId: user.id,
              projectId: invitation.projectId,
            },
          },
        });
        
        if (existingMember) {
          await bot!.answerCallbackQuery(query.id, {
            text: '⚠️ Вы уже являетесь участником этого проекта',
            show_alert: true,
          });
          
          // Update invitation status
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: 'accepted', acceptedAt: new Date() },
          });
          
          // Edit message to remove buttons
          await bot!.editMessageText(
            `✅ Приглашение уже принято\n\n` +
            `📁 Проект: ${invitation.project.name}\n` +
            `👤 От: ${invitation.invitedByUser?.name || 'Пользователь'}\n\n` +
            `Вы уже являетесь участником этого проекта.`,
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          
          return;
        }
        
        // Add user to project
        const projectMember = await prisma.projectMember.create({
          data: {
            userId: user.id,
            projectId: invitation.projectId,
            role: invitation.role,
          },
        });
        
        // Update invitation status
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'accepted', acceptedAt: new Date() },
        });
        
        // Import WebSocket functions
        const { emitInviteAccepted, emitProjectMemberAdded } = await import('./websocket.js');
        
        // Emit WebSocket events
        emitInviteAccepted(invitation.id, invitation.projectId, user.id);
        emitProjectMemberAdded(invitation.projectId, projectMember);
        
        // Answer callback query
        await bot!.answerCallbackQuery(query.id, {
          text: '✅ Приглашение принято!',
        });
        
        // Edit message to remove buttons
        await bot!.editMessageText(
          `✅ Приглашение принято!\n\n` +
          `📁 Проект: ${invitation.project.name}\n` +
          `👤 От: ${invitation.invitedByUser?.name || 'Пользователь'}\n\n` +
          `Теперь вы участник проекта. Откройте приложение для просмотра задач.`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      } else {
        // Decline invitation
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'declined' },
        });
        
        // Answer callback query
        await bot!.answerCallbackQuery(query.id, {
          text: '❌ Приглашение отклонено',
        });
        
        // Edit message to remove buttons
        await bot!.editMessageText(
          `❌ Приглашение отклонено\n\n` +
          `📁 Проект: ${invitation.project.name}\n` +
          `👤 От: ${invitation.invitedByUser?.name || 'Пользователь'}`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      }
    }
  } catch (error) {
    console.error('Callback query error:', error);
    await bot!.answerCallbackQuery(query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true,
    });
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
    
    const priorityTranslation: Record<string, string> = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      urgent: 'Срочный',
    };
    
    const emoji = priorityEmoji[task.priority] || '⚪';
    const priorityText = priorityTranslation[task.priority] || task.priority;
    
    const message =
      `${emoji} Вам назначена новая задача!\n\n` +
      `📋 ${task.title}\n` +
      (task.description ? `📝 ${task.description.slice(0, 100)}${task.description.length > 100 ? '...' : ''}\n\n` : '\n') +
      (task.projectName ? `📁 Проект: ${task.projectName}\n` : '') +
      `👤 От: ${task.assignerName}\n` +
      `⏰ Приоритет: ${priorityText}\n\n` +
      `🔗 Открыть: ${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173'}/tasks/${task.id}`;
    
    await bot.sendMessage(user.telegramChatId, message);
    console.log(`📤 Telegram notification sent to user ${userId}`);
  } catch (error) {
    console.error('Send Telegram notification error:', error);
  }
}

/**
 * Send notification about project invitation
 */
export async function sendProjectInvitationNotification(
  email: string,
  projectName: string,
  inviterName: string,
  role: string,
  token: string
) {
  if (!bot) {
    console.log('⚠️  Telegram bot not initialized, skipping notification');
    return;
  }
  
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { telegramChatId: true },
    });
    
    if (!user?.telegramChatId) {
      console.log(`ℹ️  User ${email} has no Telegram linked, skipping notification`);
      return;
    }
    
    // Translate role to Russian
    const roleTranslation: Record<string, string> = {
      owner: 'Владелец',
      admin: 'Администратор',
      collaborator: 'Участник с правами',
      member: 'Участник',
      viewer: 'Наблюдатель',
    };
    
    const roleText = roleTranslation[role] || role;
    
    const message =
      `🎉 Вас пригласили в проект!\n\n` +
      `📁 Проект: ${projectName}\n` +
      `👤 От: ${inviterName}\n` +
      `🎭 Роль: ${roleText}\n\n` +
      `Что вы хотите сделать?`;
    
    // Create inline keyboard with Accept/Decline buttons
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Принять', callback_data: `accept_${token}` },
          { text: '❌ Отклонить', callback_data: `decline_${token}` },
        ],
      ],
    };
    
    await bot.sendMessage(user.telegramChatId, message, {
      reply_markup: keyboard,
    });
    
    console.log(`📤 Telegram invitation notification sent to ${email}`);
  } catch (error) {
    console.error('Send Telegram invitation notification error:', error);
  }
}

/**
 * Get Telegram bot instance
 */
export function getTelegramBot() {
  return bot;
}
