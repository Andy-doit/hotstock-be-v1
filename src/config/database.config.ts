import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  directUrl: string;
}

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    url: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || '',
  }),
);
