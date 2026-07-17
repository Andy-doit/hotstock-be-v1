import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import {
  getSafeErrorLogMessage,
  getSafeErrorLogStack,
} from '../../../common/utils/log-redaction';
import { renderOtpEmail } from '../../../common/utils/email-template';
import type {
  AuditLogJob,
  EmailQueueJobData,
  SendOtpJob,
} from '../types/email-job.types';

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
      secure: this.configService.get<boolean>('app.smtp.secure', false),
      auth: {
        user: this.configService.get<string>('app.smtp.user'),
        pass: this.configService.get<string>('app.smtp.pass'),
      },
    });
  }

  async process(job: Job<EmailQueueJobData, void, string>): Promise<void> {
    if (this.isSendOtpJob(job)) {
      await this.handleSendOtp(job);
      return;
    }

    if (this.isAuditLogJob(job)) {
      await this.handleAuditLog(job);
      return;
    }

    this.logger.warn(`No handler for job name: ${job.name}`);
  }

  private isSendOtpJob(
    job: Job<EmailQueueJobData, void, string>,
  ): job is SendOtpJob {
    return job.name === 'send_otp';
  }

  private isAuditLogJob(
    job: Job<EmailQueueJobData, void, string>,
  ): job is AuditLogJob {
    return job.name === 'audit_log';
  }

  private async handleSendOtp(job: SendOtpJob): Promise<void> {
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

    const htmlTemplate = renderOtpEmail(
      otp,
      this.configService.get<string>('app.url'),
    );

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('app.smtp.from'),
        to,
        subject,
        html: htmlTemplate,
      });

      // Mark as sent in Redis with 24h TTL
      if (job.id) {
        await this.redis.set(idempotencyKey, '1', 'EX', 86400);
      }

      this.logger.log({
        msg: 'OTP notification sent',
        jobId: job.id,
        jobName: job.name,
        messageCategory: 'otp',
      });
    } catch (error: unknown) {
      const message = getSafeErrorLogMessage(error);
      const stack = getSafeErrorLogStack(error);

      this.logger.error(
        `Failed to send OTP notification for job ${job.id ?? 'unknown'}: ${message}`,
        stack,
      );
      throw error;
    }
  }

  private async handleAuditLog(job: AuditLogJob): Promise<void> {
    const { userId, action, resource, resourceId, ipAddress, userAgent } =
      job.data;

    await this.prisma.auditLog.create({
      data: { userId, action, resource, resourceId, ipAddress, userAgent },
    });

    this.logger.debug({
      msg: 'Audit log written',
      jobId: job.id,
      action,
      resource,
    });
  }
}
