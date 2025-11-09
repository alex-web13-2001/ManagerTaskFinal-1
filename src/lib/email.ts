import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email Service for sending notifications
 * Uses SMTP configuration from environment variables
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private from: string;
  private fromName: string;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'noreply@taskmanager.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Task Manager';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    // Skip email initialization in development if credentials are not set
    if (!emailHost || !emailUser || !emailPassword) {
      console.warn('⚠️ Email service not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD in .env');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort || '587'),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      console.log('✅ Email service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('⚠️ Email not sent - transporter not configured');
      return false;
    }

    try {
      const mailOptions = {
        from: `"${this.fromName}" <${this.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(email: string, name: string, verificationToken?: string): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const verificationLink = verificationToken 
      ? `${appUrl}/verify-email?token=${verificationToken}`
      : null;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Добро пожаловать в Task Manager!</h1>
          </div>
          <div class="content">
            <h2>Привет, ${name}!</h2>
            <p>Спасибо за регистрацию в Task Manager. Мы рады приветствовать вас!</p>
            
            ${verificationLink ? `
              <p>Пожалуйста, подтвердите ваш email адрес, нажав на кнопку ниже:</p>
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button">Подтвердить email</a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Или скопируйте эту ссылку в браузер:<br>${verificationLink}</p>
            ` : `
              <p>Ваш аккаунт активирован и готов к использованию!</p>
            `}
            
            <p>С помощью Task Manager вы можете:</p>
            <ul>
              <li>Создавать и управлять проектами</li>
              <li>Организовывать задачи в Kanban досках</li>
              <li>Приглашать участников команды</li>
              <li>Отслеживать прогресс работы</li>
            </ul>
            
            <p>Если у вас есть вопросы, не стесняйтесь обращаться к нам.</p>
          </div>
          <div class="footer">
            <p>© 2025 Task Manager. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Добро пожаловать в Task Manager!',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Восстановление пароля</h1>
          </div>
          <div class="content">
            <h2>Привет, ${name}!</h2>
            <p>Мы получили запрос на восстановление пароля для вашего аккаунта в Task Manager.</p>
            
            <p>Чтобы сбросить пароль, нажмите на кнопку ниже:</p>
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Сбросить пароль</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">Или скопируйте эту ссылку в браузер:<br>${resetLink}</p>
            
            <div class="warning">
              <strong>⏰ Внимание:</strong> Эта ссылка действительна в течение 1 часа.
            </div>
            
            <p><strong>Если вы не запрашивали восстановление пароля</strong>, просто проигнорируйте это письмо. Ваш пароль не будет изменен.</p>
            
            <p>Из соображений безопасности, никогда не делитесь этой ссылкой с другими.</p>
          </div>
          <div class="footer">
            <p>© 2025 Task Manager. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Восстановление пароля - Task Manager',
      html,
    });
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(email: string, name: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Пароль успешно изменен</h1>
          </div>
          <div class="content">
            <h2>Привет, ${name}!</h2>
            <p>Ваш пароль в Task Manager был успешно изменен.</p>
            
            <p>Если это были не вы, немедленно свяжитесь с нами и измените пароль.</p>
            
            <p>Дата изменения: ${new Date().toLocaleString('ru-RU')}</p>
          </div>
          <div class="footer">
            <p>© 2025 Task Manager. Все права защищены.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Пароль изменен - Task Manager',
      html,
    });
  }

  /**
   * Send project invitation email
   */
  async sendProjectInvitationEmail(
    email: string,
    projectName: string,
    inviterName: string,
    role: string,
    invitationId: string,
    expiresAt: string
  ): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const inviteLink = `${appUrl}/invite/${invitationId}`;
    
    const roleLabels: Record<string, string> = {
      owner: 'Владелец',
      admin: 'Администратор',
      collaborator: 'Участник с правами',
      member: 'Участник',
      viewer: 'Наблюдатель',
    };
    
    const roleDescriptions: Record<string, string> = {
      owner: 'Полный контроль над проектом',
      admin: 'Управление участниками и приглашениями',
      collaborator: 'Создание и редактирование задач',
      member: 'Просмотр и редактирование своих задач',
      viewer: 'Только просмотр проекта',
    };
    
    const roleLabel = roleLabels[role] || role;
    const roleDescription = roleDescriptions[role] || '';
    const expiryDate = new Date(expiresAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7C3AED; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 14px 28px; background-color: #7C3AED; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .project-info { background-color: white; border-left: 4px solid #7C3AED; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .role-badge { display: inline-block; background-color: #EDE9FE; color: #7C3AED; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; }
          .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📩 Приглашение в проект</h1>
          </div>
          <div class="content">
            <h2>Вас приглашают в проект!</h2>
            <p><strong>${inviterName}</strong> приглашает вас присоединиться к проекту в Task Manager.</p>
            
            <div class="project-info">
              <h3 style="margin-top: 0;">📁 ${projectName}</h3>
              <p><strong>Ваша роль:</strong> <span class="role-badge">${roleLabel}</span></p>
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">${roleDescription}</p>
            </div>
            
            <p>Нажмите на кнопку ниже, чтобы принять приглашение:</p>
            <div style="text-align: center;">
              <a href="${inviteLink}" class="button">Принять приглашение</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">Или скопируйте эту ссылку в браузер:<br><a href="${inviteLink}">${inviteLink}</a></p>
            
            <div class="warning">
              <strong>⏰ Срок действия:</strong> Приглашение действительно до ${expiryDate}
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">После принятия приглашения вы сможете сразу начать работу над проектом в соответствии с вашими правами доступа.</p>
          </div>
          <div class="footer">
            <p>© 2025 Task Manager. Все права защищены.</p>
            <p style="font-size: 12px; color: #9ca3af;">Если вы не ожидали это приглашение, можете проигнорировать это письмо.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Приглашение в проект "${projectName}" - Task Manager`,
      html,
    });
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
