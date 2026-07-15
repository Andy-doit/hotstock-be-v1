import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';

interface SendOtpData {
  to: string;
  subject: string;
  otp: string;
}

interface AuditLogData {
  userId: number | null;
  action: string;
  resource: string;
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
@Processor('email', {
  concurrency: 5,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    super();
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

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send_otp') {
      return this.handleSendOtp(job as Job<SendOtpData, any, string>);
    }
    if (job.name === 'audit_log') {
      return this.handleAuditLog(job as Job<AuditLogData, any, string>);
    }

    this.logger.warn(`No handler for job name: ${job.name}`);
  }

  private async handleSendOtp(job: Job<SendOtpData, any, string>) {
    const idempotencyKey = `email:sent:${job.id}`;
    
    // Check if email was already sent for this job ID
    if (job.id) {
      const alreadySent = await this.redis.get(idempotencyKey);
      if (alreadySent) {
        this.logger.debug(`Job ${job.id} already sent, skipping...`);
        return;
      }
    }

    const { to, subject, otp } = job.data;

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            background-color: #0f0f0f;
            color: #ffffff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 480px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #1a1a1a;
            border-radius: 8px;
            margin-top: 40px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #f59e0b;
            font-size: 24px;
            margin: 0;
          }
          .content {
            text-align: center;
          }
          .content h2 {
            font-size: 20px;
            margin-bottom: 20px;
          }
          .otp-code {
            font-size: 48px;
            font-weight: bold;
            font-family: monospace;
            color: #f59e0b;
            letter-spacing: 4px;
            margin: 30px 0;
          }
          .note {
            font-size: 14px;
            color: #a3a3a3;
            margin-bottom: 10px;
          }
          .warning {
            font-size: 14px;
            color: #ef4444;
            font-weight: bold;
            margin-bottom: 30px;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #737373;
            margin-top: 40px;
            border-top: 1px solid #333;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hotstock</h1>
          </div>
          <div class="content">
            <h2>Mã OTP của bạn</h2>
            <div class="otp-code">${otp}</div>
            <p class="note">Mã có hiệu lực trong 10 phút</p>
            <p class="warning">Không chia sẻ mã này với bất kỳ ai</p>
          </div>
          <div class="footer">
            <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
            <p>Hotstock Support Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Hotstock" <${this.configService.get<string>('app.smtp.user')}>`,
        to,
        subject,
        html: htmlTemplate,
      });

      // Mark as sent in Redis with 24h TTL
      if (job.id) {
        await this.redis.set(idempotencyKey, '1', 'EX', 86400);
      }

      this.logger.log({
        msg: 'Successfully sent OTP email',
        jobId: job.id,
        to,
        subject,
      });
    } catch (error: any) {
      this.logger.error({
        msg: 'Failed to send OTP email',
        jobId: job.id,
      });
      throw error;
    }
  }

  private async handleAuditLog(job: Job<AuditLogData, any, string>) {
    const { userId, action, resource, ipAddress, userAgent } = job.data;

    await this.prisma.auditLog.create({
      data: { userId, action, resource, ipAddress, userAgent },
    });

    this.logger.debug({
      msg: 'Audit log written',
      jobId: job.id,
      action,
      resource,
    });
  }
}
