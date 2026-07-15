import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheckService,
  HealthCheck,
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error: any) {
      throw new HealthCheckError(
        'Prisma check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}

class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (error: any) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly prismaIndicator: PrismaHealthIndicator;
  private readonly redisIndicator: RedisHealthIndicator;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.prismaIndicator = new PrismaHealthIndicator(this.prisma);
    this.redisIndicator = new RedisHealthIndicator(this.redis);
  }

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Kiểm tra trạng thái hệ thống',
    description: 'Health check cho Database (PostgreSQL) và Cache (Redis)',
  })
  check() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
