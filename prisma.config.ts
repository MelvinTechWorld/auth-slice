import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

// NOTE: We are on Prisma v8 (Prisma Next), which uses this prisma.config.ts 
// configuration file to wire up the database connection and contract path
// instead of relying purely on .env-based config as in older versions.
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
