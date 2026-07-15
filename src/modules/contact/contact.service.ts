import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SendContactDto } from './dto/send-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('app.smtp.host'),
      port: this.configService.get<number>('app.smtp.port'),
      secure: false,
      auth: {
        user: this.configService.get<string>('app.smtp.user'),
        pass: this.configService.get<string>('app.smtp.pass'),
      },
    });
  }

  async sendContact(dto: SendContactDto): Promise<{ success: boolean; message: string }> {
    const { fullname, email, message, optIn, phoneNumber, termsAccepted } = dto;
    const fromEmail = this.configService.get<string>('app.smtp.user');
    const toEmail = this.configService.get<string>('CONTACT_RECEIVER_EMAIL') || fromEmail;
    const senderEmail = email || `noreply-${Date.now()}@hotstock.vn`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f9f9f9;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e5e7eb;
          }
          .header {
            border-bottom: 2px solid #f59e0b;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h2 {
            color: #f59e0b;
            margin: 0;
            font-size: 20px;
          }
          .field {
            margin-bottom: 15px;
          }
          .label {
            font-weight: bold;
            color: #4b5563;
            font-size: 14px;
          }
          .value {
            color: #111827;
            font-size: 16px;
            background-color: #f3f4f6;
            padding: 10px;
            border-radius: 4px;
            white-space: pre-wrap;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Yêu cầu liên hệ mới từ HotStock</h2>
          </div>
          <div class="field">
            <div class="label">Họ và tên:</div>
            <div class="value">${fullname}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value">${email || 'Không cung cấp'}</div>
          </div>
          <div class="field">
            <div class="label">Số điện thoại:</div>
            <div class="value">${phoneNumber || 'Không cung cấp'}</div>
          </div>
          <div class="field">
            <div class="label">Nội dung lời nhắn:</div>
            <div class="value">${message}</div>
          </div>
          <div class="field">
            <div class="label">Đăng ký nhận tin tức:</div>
            <div class="value">${optIn ? 'Có' : 'Không'}</div>
          </div>
          <div class="field">
            <div class="label">Đồng ý điều khoản và xử lý thông tin cá nhân:</div>
            <div class="value">${termsAccepted ? 'Có' : 'Không'}</div>
          </div>
          <div class="footer">
            <p>Email này được gửi tự động từ hệ thống HotStock Contact Form.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"HotStock Contact" <${fromEmail}>`,
        to: toEmail,
        replyTo: email ? email.trim() : undefined,
        subject: `[HotStock Contact] Lời nhắn mới từ ${fullname}`,
        html: htmlContent,
      });

      this.logger.log(`Successfully sent contact email from ${fullname} (${senderEmail}) to ${toEmail}`);
      return { success: true, message: 'Đã gửi liên hệ thành công' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send contact email: ${message}`);
      throw new InternalServerErrorException(`Không thể gửi email liên hệ: ${message}`);
    }
  }
}
