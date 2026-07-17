import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { getSafeErrorLogStack } from '../../common/utils/log-redaction';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getErrorStack(error: unknown): string | undefined {
    return getSafeErrorLogStack(error);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredTokens(): Promise<void> {
    this.logger.log('Starting cleanup of expired refresh tokens...');
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      this.logger.log(`Cleaned up ${result.count} expired refresh tokens.`);
    } catch (error: unknown) {
      this.logger.error(
        'Failed to clean up refresh tokens',
        this.getErrorStack(error),
      );
    }
  }

  @Cron('0 1 * * *')
  async handleExpiredOTPs(): Promise<void> {
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
    } catch (error: unknown) {
      this.logger.error('Failed to clean up OTPs', this.getErrorStack(error));
    }
  }

  @Cron('0 2 * * *')
  async handleOldAuditLogs(): Promise<void> {
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
    } catch (error: unknown) {
      this.logger.error(
        'Failed to clean up audit logs',
        this.getErrorStack(error),
      );
    }
  }
}
