import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export class EmailService {
  private static instance: EmailService;
  private fromEmail: string;
  private resend: Resend | null = null;

  private constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
  }

  private getResendClient(): Resend {
    if (!this.resend) {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY environment variable is required');
      }
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    return this.resend;
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    name: string
  ): Promise<void> {
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verify Your Email Address</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Thank you for signing up! Please verify your email address to complete your registration and access all features.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${verificationUrl}</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} FinTech SaaS. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const resend = this.getResendClient();
      await resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Verify Your Email Address',
        html,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to FinTech SaaS!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Your email has been verified successfully! You're all set to start using FinTech SaaS.</p>

              <h3>Here's what you can do:</h3>
              <div class="feature">
                <strong>📄 Invoice Management</strong><br>
                Upload and process invoices with AI-powered OCR
              </div>
              <div class="feature">
                <strong>🏦 Bank Integration</strong><br>
                Connect your bank accounts and analyze transactions
              </div>
              <div class="feature">
                <strong>📊 Analytics Dashboard</strong><br>
                Get real-time insights into your financial data
              </div>
              <div class="feature">
                <strong>💰 Cash Flow Forecasting</strong><br>
                Predict and manage your cash flow effectively
              </div>

              <p style="text-align: center;">
                <a href="${process.env.NEXTAUTH_URL}" class="button">Get Started</a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} FinTech SaaS. All rights reserved.</p>
              <p>Need help? Contact us at support@yourdomain.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const resend = this.getResendClient();
      await resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Welcome to FinTech SaaS!',
        html,
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw error for welcome email
    }
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    name: string
  ): Promise<void> {
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} FinTech SaaS. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const resend = this.getResendClient();
      await resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Reset Your Password',
        html,
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }
}

export const emailService = EmailService.getInstance();
