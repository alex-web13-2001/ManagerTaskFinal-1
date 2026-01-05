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
    setTimeout(() => this.initializeTransporter(), 100);
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
  async sendWelcomeEmail(email: string, name: string, verificationToken: string): Promise<boolean> {
    const verificationLink = `${process.env.FRONTEND_URL}/?token=${verificationToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Добро пожаловать в Task Manager T24!</h1>
        <p>Здравствуйте, ${name}!</p>
        <p>Спасибо за регистрацию в Task Manager T24 — вашем новом инструменте для управления задачами и проектами.</p>
        <p>Чтобы начать работу, пожалуйста, активируйте ваш аккаунт, перейдя по ссылке ниже:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #7c3aed; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Активировать аккаунт
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Если вы не регистрировались в Task Manager T24, просто проигнорируйте это письмо.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          С уважением,<br>
          Команда Task Manager T24
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Добро пожаловать в Task Manager T24!',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetLink = `${process.env.FRONTEND_URL}/?reset-token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Восстановление пароля</h1>
        <p>Вы запросили восстановление пароля для вашего аккаунта в Task Manager T24.</p>
        <p>Чтобы сбросить пароль, перейдите по ссылке ниже:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #7c3aed; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Сбросить пароль
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Ссылка будет активна в течение 1 часа.
        </p>
        <p style="color: #666; font-size: 14px;">
          Если вы не запрашивали восстановление пароля, проигнорируйте это письмо. 
          Ваш пароль останется без изменений.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          С уважением,<br>
          Команда Task Manager T24
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Восстановление пароля в Task Manager T24',
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
    invitationToken: string,
    expiresAt: string
  ): Promise<boolean> {
    const invitationLink = `${process.env.FRONTEND_URL}/invite?token=${invitationToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">Приглашение в проект</h1>
        <p><strong>${inviterName}</strong> пригласил вас присоединиться к проекту 
           <strong>"${projectName}"</strong> в Task Manager T24.</p>
        <p>Ваша роль в проекте: <strong>${role}</strong></p>
        <p>Чтобы присоединиться к проекту, перейдите по ссылке ниже:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationLink}" 
             style="background-color: #7c3aed; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Принять приглашение
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Приглашение действительно до: ${new Date(expiresAt).toLocaleString('ru-RU')}
        </p>
        <p style="color: #666; font-size: 14px;">
          Если вы не ожидали этого приглашения, просто проигнорируйте это письмо.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          С уважением,<br>
          Команда Task Manager T24
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `Вас пригласили в проект Task Manager T24`,
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
