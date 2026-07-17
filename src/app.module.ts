import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';

import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import databaseConfig from './config/database.config';
import throttlerConfig from './config/throttler.config';
import { validationSchema } from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlansModule } from './modules/plans/plans.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';
import { RedisModule } from './modules/redis/redis.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TagsModule } from './modules/tags/tags.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ContactModule } from './modules/contact/contact.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        redisConfig,
        databaseConfig,
        throttlerConfig,
      ],
      validationSchema,
    }),

    PrismaModule,

    // Named contexts must match what controllers reference via @Throttle({ name: {...} }),
    // e.g. auth.controller.ts uses 'medium' and 'long'. ThrottlerGuard is registered
    // below as a global APP_GUARD — without it these throttlers are never enforced.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService, 'REDIS_CLIENT'],
      useFactory: (config: ConfigService, redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('throttler.ttl', 60000),
            limit: config.get<number>('throttler.limit', 300),
          },
          { name: 'medium', ttl: 60000, limit: 60 },
          { name: 'long', ttl: 600000, limit: 80 },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),

    AuthModule,
    UsersModule,
    PlansModule,
    CategoriesModule,
    ArticlesModule,
    PortfoliosModule,
    HealthModule,
    QueueModule,
    RedisModule,
    DashboardModule,
    TagsModule,
    JobsModule,
    ContactModule,
    SiteSettingsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      // Enforces the @Throttle(...) decorators used across controllers (e.g. login,
      // register, forgot-password). Without this, ThrottlerModule only provides
      // storage/config — rate limiting never runs on decorated routes.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
