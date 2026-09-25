import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

function createPrismaClient() {
  const baseClient = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const maxRetries = 2;
          let lastError: any;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await query(args);
            } catch (err: any) {
              lastError = err;
              const errStr = String(err?.message || '') + ' ' + String(err?.stack || '');
              const isTransientDbError =
                err?.code === 'P1001' || // Can't reach database server
                err?.code === 'P1002' || // Database server was reached but timed out
                err?.code === 'P1008' || // Operations timed out
                err?.code === 'P1017' || // Server has closed the connection
                errStr.includes('10054') ||
                errStr.includes('ConnectionReset') ||
                errStr.includes('Closed') ||
                errStr.includes('Connection closed') ||
                errStr.includes('Connection lost') ||
                errStr.includes('socket has been ended') ||
                errStr.includes('connection terminated') ||
                errStr.includes('ECONNRESET');

              if (isTransientDbError && attempt < maxRetries) {
                console.warn(
                  `[Prisma Retry] Transient database error on ${model}.${operation} (attempt ${attempt + 1}/${maxRetries}). Retrying...`
                );
                await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
                continue;
              }
              throw err;
            }
          }
          throw lastError;
        },
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrisma | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Always cache Prisma instance on globalThis (including production)
// to reuse connection pools across warm lambdas and local server reloads
globalForPrisma.prisma = prisma;
