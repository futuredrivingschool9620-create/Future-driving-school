import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('server/.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({
    include: {
      vehicles: true,
      documents: true,
    },
  });

  console.log(`Total customers: ${customers.length}`);
  for (const c of customers) {
    console.log(`\nCustomer: ${c.firstName} ${c.secondName || ''} | Phone: ${c.phoneNumber} | Active: ${c.isActive}`);
    console.log(`  Vehicles (${c.vehicles.length}):`);
    for (const v of c.vehicles) {
      console.log(`    - ID: ${v.id} | Plate: ${v.vehicleNumber} | Active: ${v.isActive}`);
    }
    console.log(`  Documents (${c.documents.length}):`);
    for (const d of c.documents) {
      console.log(`    - Name: ${d.documentName} | vehicleId: ${d.vehicleId} | Start: ${d.startDate?.toISOString()} | End: ${d.endDate?.toISOString()} | isCurrent: ${d.isCurrent} | isActive: ${d.isActive}`);
    }
  }

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`\nRecent notifications (${notifications.length}):`);
  for (const n of notifications) {
    console.log(`  - To: ${n.customerName} (${n.phoneNumber}) | Doc: ${n.documentType} | Status: ${n.notificationStatus} | Created: ${n.createdAt.toISOString()} | Day: ${n.calendarDay.toISOString()}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
