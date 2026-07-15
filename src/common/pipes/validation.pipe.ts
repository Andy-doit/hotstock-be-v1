import { ValidationPipe as NestValidationPipe } from '@nestjs/common';

/**
 * Pre-configured ValidationPipe with strict settings:
 * - whitelist: strips properties not in DTO
 * - forbidNonWhitelisted: throws error for extra properties
 * - transform: auto-transforms payloads to DTO instances
 *
 * Usage in main.ts:
 *   app.useGlobalPipes(new AppValidationPipe());
 */
export class AppValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });
  }
}
