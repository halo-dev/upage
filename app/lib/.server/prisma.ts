import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

// 创建PrismaClient实例
let prisma: PrismaClient;

declare global {
  var __db: PrismaClient | undefined;
}

const adapter = new PrismaBetterSQLite3({
  url: 'file:data/upage.db',
});

// 在开发环境中使用全局变量，避免热重载时创建多个实例
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.__db) {
    global.__db = new PrismaClient({
      log: ['query', 'error', 'warn'],
      adapter,
    });
  }
  prisma = global.__db;
}

export { prisma };
