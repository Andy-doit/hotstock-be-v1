import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every night at midnight to clean up expired tokens.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredTokens() {
    this.logger.log('Starting cleanup of expired refresh tokens...');
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      this.logger.log(`Cleaned up ${result.count} expired refresh tokens.`);
    } catch (error: any) {
      this.logger.error('Failed to clean up refresh tokens', error.stack);
    }
  }

  /**
   * Run every night at 1:00 AM to clean up expired OTPs in users table.
   */
  @Cron('0 1 * * *')
  async handleExpiredOTPs() {
    this.logger.log('Starting cleanup of expired reset password OTPs...');
    try {
      const result = await this.prisma.user.updateMany({
        where: {
          resetPasswordExpires: { lt: new Date() },
          resetPasswordOtp: { not: null },
        },
        data: {
          resetPasswordOtp: null,
          resetPasswordExpires: null,
        },
      });
      this.logger.log(`Cleaned up OTPs for ${result.count} users.`);
    } catch (error: any) {
      this.logger.error('Failed to clean up OTPs', error.stack);
    }
  }

  /**
   * Run every night at 2:00 AM to delete audit logs older than 30 days.
   */
  @Cron('0 2 * * *')
  async handleOldAuditLogs() {
    this.logger.log('Starting cleanup of old audit logs (> 30 days)...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: thirtyDaysAgo },
        },
      });
      this.logger.log(`Cleaned up ${result.count} old audit logs.`);
    } catch (error: any) {
      this.logger.error('Failed to clean up audit logs', error.stack);
    }
  }
}