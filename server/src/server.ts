import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

import { SchedulerService } from './services/scheduler.service.js';

async function main() {
  try {
    // Start HTTP server immediately so health checks succeed and electron doesn't hang
    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
      console.log(`📚 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 CORS origin: ${env.CORS_ORIGIN}`);
    });

    // Connect to database with retry logic (handles Neon DB serverless cold starts & network hiccups)
    let connected = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        connected = true;
        break;
      } catch (err) {
        console.warn(`⚠️ DB connection attempt ${attempt}/5 failed, retrying in 2s...`);
        if (attempt < 5) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    if (connected) {
      SchedulerService.start();
    } else {
      console.error('⚠️ Could not connect to database after 5 attempts. Server will keep running and retry on subsequent requests.');
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
  }
}

// Catch unhandled database socket drops & async errors to prevent crashes
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  SchedulerService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  SchedulerService.stop();
  await prisma.$disconnect();
  process.exit(0);
});

main();
