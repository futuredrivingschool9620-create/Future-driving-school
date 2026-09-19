import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNotifications() {
  const all = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('Recent notifications:', JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

checkNotifications().catch(e => {
  console.error(e);
  process.exit(1);
});
