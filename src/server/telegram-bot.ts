import TelegramBot from 'node-telegram-bot-api';
import prisma from './db';
import {
  getPriorityTag,
  getMoscowDate,
  getMoscowDayStart,
  getMoscowDayEnd,
  formatDeadline,
} from './telegram-utils.js';

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
    
    // Handle link token messages (format: LINK-xxx) and reply messages
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();
      
      if (!text || text.startsWith('/')) return;
      
      // Check for link token format: LINK-XXX (6 chars)
      if (text.match(/^LINK-[A-Z0-9]{6}$/i)) {
        await handleLinkToken(chatId, text.toUpperCase(), msg.from?.username);
        return;
      }
      
      // Check for pending reply
      await handleTextReply(chatId, text);
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
 * Handle reply callback from inline keyboard
 */
async function handleReplyCallback(query: TelegramBot.CallbackQuery, chatId: number) {
  if (!bot || !query.data) return;
  
  try {
    // Parse callback data: reply:{taskId}
    const parts = query.data.split(':');
    if (parts.length !== 2) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Неверный формат данных',
        show_alert: true,
      });
      return;
    }
    
    const taskId = parts[1];
    const parentCommentId = ''; // Empty string placeholder
    
    // Find user by telegram chat ID
    const user = await prisma.user.findUnique({
      where: { telegramChatId: chatId.toString() },
    });
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Аккаунт не привязан к Telegram',
        show_alert: true,
      });
      return;
    }
    
    // Get task to show its title
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true },
    });
    
    if (!task) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Задача не найдена',
        show_alert: true,
      });
      return;
    }
    
    // Delete any existing pending reply for this user/chat
    await prisma.telegramPendingReply.deleteMany({
      where: { chatId: chatId.toString() },
    });
    
    // Create new pending reply record
    await prisma.telegramPendingReply.create({
      data: {
        userId: user.id,
        chatId: chatId.toString(),
        taskId,
        parentCommentId,
      },
    });
    
    // Answer callback query
    await bot.answerCallbackQuery(query.id, {
      text: '✍️ Введите ответ одним сообщением',
    });
    
    // Send instruction message
    await bot.sendMessage(
      chatId,
      `✍️ Напишите текст ответа на комментарий к задаче «${task.title}» одним сообщением.\n` +
      `Ваш следующий текст будет добавлен как комментарий в T24.`
    );
    
    console.log(`📝 Reply callback handled for user ${user.id}, task ${taskId}`);
  } catch (error) {
    console.error('❌ Error handling reply callback:', error);
    await bot!.answerCallbackQuery(query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true,
    });
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
    // Handle reply callback (reply:{taskId}:{commentId})
    if (data.startsWith('reply:')) {
      await handleReplyCallback(query, chatId);
      return;
    }
    
    // Handle invitation responses (accept/decline)
    if (data.startsWith('accept_') || data.startsWith('decline_')) {
      const action = data.startsWith('accept_') ? 'accept' : 'decline';
      const invitationId = data.substring(action === 'accept' ? 7 : 8); // Remove "accept_" or "decline_"
      
      // Find the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
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
 * Handle text message as reply to comment
 */
async function handleTextReply(chatId: number, text: string) {
  if (!bot) return;
  
  try {
    // Check for pending reply
    const pending = await prisma.telegramPendingReply.findFirst({
      where: { chatId: chatId.toString() },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!pending) {
      // No pending reply, ignore message
      return;
    }
    
    const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
    
    try {
      // Create comment from user
      const comment = await addTaskCommentFromUser(pending.userId, pending.taskId, text);
      
      // Delete pending reply
      await prisma.telegramPendingReply.delete({
        where: { id: pending.id },
      });
      
      // Send success message
      await bot.sendMessage(
        chatId,
        `✅ Ваш ответ добавлен как комментарий к задаче.\n\n` +
        `🔗 Открыть задачу: ${frontendBase}/tasks/${pending.taskId}`
      );
      
      console.log(`✅ Reply added as comment for user ${pending.userId}, task ${pending.taskId}`);
    } catch (error: any) {
      console.error('❌ Error adding comment from reply:', error);
      
      // Delete pending reply
      await prisma.telegramPendingReply.delete({
        where: { id: pending.id },
      });
      
      // Send error message
      await bot.sendMessage(
        chatId,
        `❌ Не удалось добавить комментарий. Возможно, у вас нет доступа к этой задаче или задача была удалена.`
      );
    }
  } catch (error) {
    console.error('❌ Error handling text reply:', error);
  }
}

/**
 * Add comment to task from user (with access checks)
 */
async function addTaskCommentFromUser(userId: string, taskId: string, text: string) {
  // Get task with access info
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          members: {
            where: { userId }
          }
        }
      }
    }
  });
  
  if (!task) {
    throw new Error('Задача не найдена');
  }
  
  // Check access: task creator, assignee, or project member
  const isCreator = task.creatorId === userId;
  const isAssignee = task.assigneeId === userId;
  const isProjectMember = task.project?.members.length > 0;
  const isProjectOwner = task.project?.ownerId === userId;
  
  if (!isCreator && !isAssignee && !isProjectMember && !isProjectOwner) {
    throw new Error('Нет доступа к этой задаче');
  }
  
  // Create comment
  const comment = await prisma.comment.create({
    data: {
      text: text.trim(),
      taskId,
      createdBy: userId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  });
  
  // Emit WebSocket event for real-time updates (only for project tasks)
  if (task.projectId) {
    const { emitCommentAdded } = await import('./websocket.js');
    const commentData = {
      id: comment.id,
      text: comment.text,
      createdBy: comment.createdBy,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user
    };
    emitCommentAdded(taskId, commentData, task.projectId);
  }
  
  return comment;
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
    
    const priorityTag = getPriorityTag(task.priority);
    const [emoji] = priorityTag.split(' ');
    
    const message =
      `${emoji} Вам назначена новая задача!\n\n` +
      `📋 ${task.title}\n` +
      (task.description ? `📝 ${task.description.slice(0, 100)}${task.description.length > 100 ? '...' : ''}\n\n` : '\n') +
      (task.projectName ? `📁 Проект: ${task.projectName}\n` : '') +
      `👤 От: ${task.assignerName}\n` +
      `⏰ Приоритет: ${priorityTag.split(' ').slice(1).join(' ')}\n\n` +
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
  invitationId: string
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
          { text: '✅ Принять', callback_data: `accept_${invitationId}` },
          { text: '❌ Отклонить', callback_data: `decline_${invitationId}` },
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
 * Determine who should receive a comment notification
 * @param task - Task with creatorId and assigneeId
 * @param commentAuthorId - ID of the user who created the comment
 * @returns User ID who should receive the notification, or null
 */
export function getCommentNotificationRecipient(
  task: { creatorId: string | null; assigneeId: string | null },
  commentAuthorId: string
): string | null {
  // Collect participants (creator and assignee)
  const participants: string[] = [];
  
  if (task.creatorId) {
    participants.push(task.creatorId);
  }
  if (task.assigneeId && task.assigneeId !== task.creatorId) {
    participants.push(task.assigneeId);
  }
  
  // If no participants, return null
  if (participants.length === 0) {
    console.log(`ℹ️  No participants for comment notification`);
    return null;
  }
  
  // If only one participant and it's the author, return null
  if (participants.length === 1 && participants[0] === commentAuthorId) {
    console.log(`ℹ️  Comment author is the only participant`);
    return null;
  }
  
  // If there are participants, return the first one that's not the author
  const recipient = participants.find(p => p !== commentAuthorId);
  return recipient || null;
}

/**
 * Send notification about new comment on task
 */
export async function sendTaskCommentNotification(
  task: {
    id: string;
    title: string;
    creatorId: string | null;
    assigneeId: string | null;
    project?: { name?: string | null } | null;
  },
  comment: {
    id: string;
    text: string;
    createdBy: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  }
) {
  if (!bot) {
    console.log('⚠️  Telegram bot not initialized, skipping notification');
    return;
  }
  
  try {
    // Get recipient
    const recipientId = getCommentNotificationRecipient(task, comment.createdBy);
    
    if (!recipientId) {
      console.log(`ℹ️  No recipient for comment notification on task ${task.id}`);
      return;
    }
    
    // Get recipient data
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { telegramChatId: true, name: true },
    });
    
    if (!recipient?.telegramChatId) {
      console.log(`ℹ️  User ${recipientId} has no Telegram linked, skipping notification`);
      return;
    }
    
    // Get author data
    const author = await prisma.user.findUnique({
      where: { id: comment.createdBy },
      select: { name: true, email: true },
    });
    
    const authorName = author?.name || author?.email || 'Неизвестный пользователь';
    const projectName = task.project?.name;
    const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
    const taskUrl = `${frontendBase}/tasks/${task.id}`;
    
    // Shorten comment text
    const shortText = comment.text.length > 200 
      ? comment.text.substring(0, 200) + '…'
      : comment.text;
    
    // Format created date
    const createdAtStr = comment.createdAt.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    // Build message
    let message = `💬 Новый комментарий к задаче\n\n`;
    message += `📋 ${task.title}\n`;
    if (projectName) {
      message += `📁 Проект: ${projectName}\n`;
    }
    message += `👤 От: ${authorName}\n`;
    message += `🕒 ${createdAtStr}\n\n`;
    message += `📝 ${shortText}\n\n`;
    message += `Нажмите «Ответить», чтобы оставить комментарий в задаче.\n`;
    message += `🔗 Открыть задачу: ${taskUrl}`;
    
    // Send message with inline keyboard
    await bot.sendMessage(recipient.telegramChatId, message, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Ответить', callback_data: `reply:${task.id}` },
          { text: 'Открыть задачу', url: taskUrl },
        ]],
      },
    });
    
    console.log(`📤 Comment notification sent to user ${recipientId} for task ${task.id}`);
  } catch (error) {
    console.error('❌ Error sending comment notification:', error);
  }
}

/**
 * Send daily tasks digest to all users with Telegram linked
 * This should be called once a day at 06:00 UTC (09:00 Moscow time)
 */
export async function sendDailyTasksDigest() {
  if (!bot) {
    console.log('⚠️  Telegram bot not initialized, skipping digest');
    return;
  }
  
  console.log('📊 Starting daily tasks digest...');
  
  try {
    // Get all users with Telegram linked
    const users = await prisma.user.findMany({
      where: {
        telegramChatId: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        telegramChatId: true,
      },
    });
    
    console.log(`📊 Found ${users.length} users with Telegram linked`);
    
    const now = new Date();
    const moscowNow = getMoscowDate(now);
    const todayStart = getMoscowDayStart(moscowNow);
    const threeDaysEnd = getMoscowDayEnd(new Date(moscowNow.getTime() + 3 * 24 * 60 * 60 * 1000));
    
    let sentCount = 0;
    
    for (const user of users) {
      try {
        // Get user's assigned tasks with deadlines
        const tasks = await prisma.task.findMany({
          where: {
            assigneeId: user.id,
            status: { not: 'done' }, // Not completed
            dueDate: { not: null },
          },
          include: {
            project: {
              select: { name: true },
            },
          },
          orderBy: {
            dueDate: 'asc',
          },
        });
        
        // Categorize tasks
        const overdueTasks = tasks.filter(t => t.dueDate! < todayStart);
        const upcomingTasks = tasks.filter(t => 
          t.dueDate! >= todayStart && t.dueDate! <= threeDaysEnd
        );
        
        // Skip if no tasks in either category
        if (overdueTasks.length === 0 && upcomingTasks.length === 0) {
          continue;
        }
        
        // Build message
        const userName = user.name || user.email;
        let message = `🗓 Ежедневная сводка по задачам\n\n`;
        message += `Привет, ${userName}!\n\n`;
        message += `📌 Назначенные на вас задачи:\n\n`;
        
        // Overdue tasks section
        message += `⏰ Просроченные:\n`;
        if (overdueTasks.length > 0) {
          const limit = 10;
          const tasksToShow = overdueTasks.slice(0, limit);
          message += `\n`; // Add blank line after section header
          
          tasksToShow.forEach((task) => {
            const priorityTag = getPriorityTag(task.priority);
            const deadline = formatDeadline(task.dueDate!, moscowNow);
            const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
            
            // Format: emoji + priority text + " — " + task title + deadline
            message += `${priorityTag} — ${task.title} (дедлайн: ${deadline})\n`;
            if (task.project?.name) {
              message += `📁 Проект: ${task.project.name}\n`;
            }
            message += `🔗 Открыть: ${frontendBase}/tasks/${task.id}\n`;
            message += `\n`; // Blank line between tasks
          });
          
          if (overdueTasks.length > limit) {
            message += `… и ещё ${overdueTasks.length - limit} задач\n\n`;
          }
        } else {
          message += `Нет задач\n`;
        }
        
        // Upcoming tasks section
        message += `📆 Дедлайн в ближайшие 3 дня:\n`;
        if (upcomingTasks.length > 0) {
          const limit = 10;
          const tasksToShow = upcomingTasks.slice(0, limit);
          message += `\n`; // Add blank line after section header
          
          tasksToShow.forEach((task) => {
            const priorityTag = getPriorityTag(task.priority);
            const deadline = formatDeadline(task.dueDate!, moscowNow);
            const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
            
            // Format: emoji + priority text + " — " + task title + deadline
            message += `${priorityTag} — ${task.title} (дедлайн: ${deadline})\n`;
            if (task.project?.name) {
              message += `📁 Проект: ${task.project.name}\n`;
            }
            message += `🔗 Открыть: ${frontendBase}/tasks/${task.id}\n`;
            message += `\n`; // Blank line between tasks
          });
          
          if (upcomingTasks.length > limit) {
            message += `… и ещё ${upcomingTasks.length - limit} задач\n\n`;
          }
        } else {
          message += `Нет задач\n`;
        }
        
        message += `\n`;
        message += `Всего просроченных: ${overdueTasks.length}\n`;
        message += `Задач с дедлайном в ближайшие 3 дня: ${upcomingTasks.length}\n\n`;
        const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
        message += `🔗 Открыть список задач: ${frontendBase}/tasks?filter=my`;
        
        // Send message
        await bot.sendMessage(user.telegramChatId!, message);
        sentCount++;
        
        console.log(`📤 Daily digest sent to user ${user.id}`);
      } catch (error) {
        console.error(`❌ Error sending digest to user ${user.id}:`, error);
      }
    }
    
    console.log(`✅ Daily digest completed. Sent to ${sentCount} users.`);
  } catch (error) {
    console.error('❌ Error in daily digest:', error);
  }
}

export async function sendMentionNotification(
  task: {
    id: string;
    title: string;
    creatorId: string | null;
    assigneeId: string | null;
    project?: { name?: string | null } | null;
  },
  comment: {
    id: string;
    text: string;
    createdBy: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  },
  recipientId: string
) {
  if (!bot) {
    console.log('⚠️  Telegram bot not initialized, skipping mention notification');
    return;
  }
  
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { telegramChatId: true, name: true },
    });
    
    if (!recipient?.telegramChatId) {
      console.log(`ℹ️  User ${recipientId} has no Telegram linked, skipping mention notification`);
      return;
    }
    
    const author = await prisma.user.findUnique({
      where: { id: comment.createdBy },
      select: { name: true, email: true },
    });
    
    const authorName = author?.name || author?.email || 'Неизвестный пользователь';
    const projectName = task.project?.name;
    const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
    const taskUrl = `${frontendBase}/tasks/${task.id}`;
    
    const shortText = comment.text.length > 150 
      ? comment.text.substring(0, 150) + '…'
      : comment.text;
    
    let message = `💬 Вас упомянули в комментарии к задаче!\n\n`;
    message += `📋 ${task.title}\n`;
    if (projectName) {
      message += `📁 Проект: ${projectName}\n`;
    }
    message += `👤 Автор: ${authorName}\n\n`;
    message += `💭 "${shortText}"\n\n`;
    message += `🔗 Открыть задачу: ${taskUrl}`;
    
    await bot.sendMessage(recipient.telegramChatId, message, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Ответить', callback_data: `reply:${task.id}` },
          { text: 'Открыть задачу', url: taskUrl },
        ]],
      },
    });
    
    console.log(`📤 Mention notification sent to user ${recipientId} for task ${task.id}`);
  } catch (error) {
    console.error('❌ Error sending mention notification:', error);
  }
}

export async function sendSubscriberNotification(
  task: {
    id: string;
    title: string;
    creatorId: string | null;
    assigneeId: string | null;
    project?: { name?: string | null } | null;
  },
  comment: {
    id: string;
    text: string;
    createdBy: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  },
  recipientId: string
) {
  if (!bot) {
    console.log('⚠️  Telegram bot not initialized, skipping subscriber notification');
    return;
  }
  
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { telegramChatId: true, name: true },
    });
    
    if (!recipient?.telegramChatId) {
      console.log(`ℹ️  User ${recipientId} has no Telegram linked, skipping subscriber notification`);
      return;
    }
    
    const author = await prisma.user.findUnique({
      where: { id: comment.createdBy },
      select: { name: true, email: true },
    });
    
    const authorName = author?.name || author?.email || 'Неизвестный пользователь';
    const projectName = task.project?.name;
    const frontendBase = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
    const taskUrl = `${frontendBase}/tasks/${task.id}`;
    
    const shortText = comment.text.length > 150 
      ? comment.text.substring(0, 150) + '…'
      : comment.text;
    
    let message = `💬 Новый комментарий к задаче, на которую вы подписаны!\n\n`;
    message += `📋 ${task.title}\n`;
    if (projectName) {
      message += `📁 Проект: ${projectName}\n`;
    }
    message += `👤 Автор: ${authorName}\n\n`;
    message += `💭 "${shortText}"\n\n`;
    message += `🔗 Открыть задачу: ${taskUrl}`;
    
    await bot.sendMessage(recipient.telegramChatId, message, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Ответить', callback_data: `reply:${task.id}` },
          { text: 'Открыть задачу', url: taskUrl },
        ]],
      },
    });
    
    console.log(`📤 Subscriber notification sent to user ${recipientId} for task ${task.id}`);
  } catch (error) {
    console.error('❌ Error sending subscriber notification:', error);
  }
}

/**
 * Get Telegram bot instance
 */
export function getTelegramBot() {
  return bot;
}
