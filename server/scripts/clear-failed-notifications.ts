import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearFailedNotifications() {
  console.log('Clearing failed notifications so Vercel can retry...');
  
  const result = await prisma.notification.deleteMany({
    where: {
      notificationStatus: 'FAILED'
    }
  });

  console.log(`Deleted ${result.count} failed notifications.`);
  await prisma.$disconnect();
}

clearFailedNotifications().catch(e => {
  console.error(e);
  process.exit(1);
});
