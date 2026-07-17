import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotenvIfPresent(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

loadDotenvIfPresent();

const seedCommand =
  process.env.NODE_ENV === 'production'
    ? 'node dist/prisma/seed.js'
    : 'ts-node prisma/seed.ts';

export default {
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: seedCommand,
  },
};
