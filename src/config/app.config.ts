import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'staging', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3001'),

  // Database
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required. Set it in .env file.',
  }),
  DIRECT_URL: Joi.string().required().messages({
    'any.required': 'DIRECT_URL is required. Set it in .env file.',
  }),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_ACCESS_SECRET is required. Must be at least 32 characters.',
    'string.min': 'JWT_ACCESS_SECRET must be at least 32 characters.',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required. Must be at least 32 characters.',
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters.',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // SMTP
  SMTP_HOST: Joi.string().required().messages({
    'any.required': 'SMTP_HOST is required for email delivery.',
  }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().required().messages({
    'any.required': 'SMTP_USER is required for email delivery.',
  }),
  SMTP_PASS: Joi.string().required().messages({
    'any.required': 'SMTP_PASS is required for email delivery.',
  }),
  SMTP_FROM: Joi.string().required().messages({
    'any.required': 'SMTP_FROM is required. Example: "App Name <email@example.com>"',
  }),

  // AWS S3
  AWS_REGION: Joi.string().default('ap-southeast-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  AWS_S3_BUCKET: Joi.string().required().messages({
    'any.required': 'AWS_S3_BUCKET is required for file uploads.',
  }),
  AWS_S3_PRESIGN_EXPIRES: Joi.number().integer().min(60).max(3600).default(300),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().integer().default(60000),
  THROTTLE_LIMIT: Joi.number().integer().default(100),

  // Seed
  SEED_ADMIN_PASSWORD: Joi.string().min(12).optional(),

  // Bull Board — intentionally no default. Dashboard stays disabled
  // (see QueueModule.setupBullBoard) unless both are explicitly set.
  BULL_BOARD_USER: Joi.string().allow('').default(''),
  BULL_BOARD_PASS: Joi.string().allow('').default(''),
});

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  appUrl: string;
  corsOrigins: string[];
  bullBoardUser: string;
  bullBoardPass: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
}

export default registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001')
      .split(',')
      .map((origin) => origin.trim()),
    bullBoardUser: process.env.BULL_BOARD_USER || 'admin',
    bullBoardPass: process.env.BULL_BOARD_PASS || 'admin',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || '',
    },
  }),
);
