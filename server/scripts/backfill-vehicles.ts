import { prisma } from '../src/lib/prisma.js';

export async function backfillVehicles() {
  console.log('🔄 Checking existing customers for vehicle migration...');
  
  const customers = await prisma.customer.findMany({
    include: {
      vehicles: true,
      documents: true,
    },
  });

  console.log(`Found ${customers.length} total customers.`);

  let migratedCount = 0;

  for (const customer of customers) {
    if (customer.vehicles.length === 0 && customer.vehicleNumber) {
      console.log(`Migrating vehicle for customer ${customer.firstName} (${customer.vehicleNumber})...`);

      const vehicle = await prisma.vehicle.create({
        data: {
          customerId: customer.id,
          vehicleNumber: customer.vehicleNumber,
          vehicleType: customer.vehicleType || '4 Wheeler',
          status: 'Active',
          isActive: customer.isActive,
          createdByAdminId: customer.createdByAdminId,
          updatedByAdminId: customer.updatedByAdminId,
        },
      });

      // Link unlinked documents to this vehicle
      const unlinkedDocs = customer.documents.filter((d) => !d.vehicleId);
      if (unlinkedDocs.length > 0) {
        await prisma.document.updateMany({
          where: {
            customerId: customer.id,
            vehicleId: null,
          },
          data: {
            vehicleId: vehicle.id,
          },
        });
        console.log(`  Linked ${unlinkedDocs.length} documents to vehicle ${vehicle.vehicleNumber}`);
      }

      // Link unlinked notifications
      await prisma.notification.updateMany({
        where: {
          customerId: customer.id,
          vehicleId: null,
        },
        data: {
          vehicleId: vehicle.id,
        },
      });

      // Link unlinked renewal histories
      await prisma.renewalHistory.updateMany({
        where: {
          customerId: customer.id,
          vehicleId: null,
        },
        data: {
          vehicleId: vehicle.id,
        },
      });

      migratedCount++;
    } else if (customer.vehicles.length > 0) {
      // Check if any documents are unlinked
      const unlinkedDocs = customer.documents.filter((d) => !d.vehicleId);
      if (unlinkedDocs.length > 0) {
        const primaryVehicle = customer.vehicles[0];
        await prisma.document.updateMany({
          where: {
            customerId: customer.id,
            vehicleId: null,
          },
          data: {
            vehicleId: primaryVehicle.id,
          },
        });
        console.log(`  Linked ${unlinkedDocs.length} previously unlinked documents to primary vehicle ${primaryVehicle.vehicleNumber}`);
      }
    }
  }

  console.log(`✅ Backfill complete. Migrated ${migratedCount} customers to vehicles.`);
}

// Run directly if invoked as script
if (process.argv[1]?.includes('backfill-vehicles')) {
  backfillVehicles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration error:', err);
      process.exit(1);
    });
}
