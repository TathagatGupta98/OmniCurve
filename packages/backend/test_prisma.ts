import { PrismaClient } from '@prisma/client';
import config from './prisma.config';
import 'dotenv/config';

console.log("Config object:", config);

try {
  const prisma = new PrismaClient(config as any);
  console.log("PrismaClient instantiated successfully!");
  process.exit(0);
} catch (e) {
  console.error("Failed with config:", e.message);
}

try {
  const prisma3 = new PrismaClient({ datasource: { url: process.env.DATABASE_URL } } as any);
  console.log("PrismaClient instantiated with datasource!");
} catch (e) {
  console.error("Failed with datasource:", e.message);
}
