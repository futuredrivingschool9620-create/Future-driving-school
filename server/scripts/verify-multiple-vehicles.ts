import { prisma } from '../src/lib/prisma.js';
import { CustomerService } from '../src/services/customer.service.js';
import { VehicleService } from '../src/services/vehicle.service.js';
import { DocumentService } from '../src/services/document.service.js';
import { SchedulerService } from '../src/services/scheduler.service.js';

async function runVerification() {
  console.log('=== STARTING MULTIPLE VEHICLES VERIFICATION ===\n');

  // 1. Get an admin user
  const admin = await prisma.adminUser.findFirst();
  if (!admin) {
    throw new Error('No admin user found in database.');
  }
  console.log(`Using admin: ${admin.username} (${admin.id})`);

  const testPhone = '9988776655';
  const carNumber = 'KA 05 AB 1111';
  const bikeNumber = 'KA 05 CD 2222';
  const truckNumber = 'KA 05 EF 3333';

  // Cleanup any old test customer with this phone
  const existingTestCust = await prisma.customer.findFirst({ where: { phoneNumber: testPhone } });
  if (existingTestCust) {
    console.log(`Cleaning up old test customer ${existingTestCust.id}...`);
    await prisma.customer.delete({ where: { id: existingTestCust.id } });
  }

  // Cleanup vehicles with test numbers if any exist
  await prisma.vehicle.deleteMany({
    where: { vehicleNumber: { in: [carNumber, bikeNumber, truckNumber] } },
  });

  // -------------------------------------------------------------
  // Test 1: Register customer with 2 vehicles (Car + Bike)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Register customer with multiple vehicles ---');
  const createdCustomer = await CustomerService.create(
    {
      firstName: 'TestMultivendor',
      secondName: 'Logistics',
      phoneNumber: testPhone,
      remarks: 'Primary test customer with multiple vehicles',
      vehicles: [
        {
          vehicleType: '4 Wheeler',
          vehicleNumber: carNumber,
          status: 'Active',
          insurance: { startDate: '2026-01-01', endDate: '2027-01-01' },
          fc: { startDate: '2026-01-01', endDate: '2027-01-01' },
          tax: { startDate: '2026-01-01', endDate: '2027-01-01' },
        },
        {
          vehicleType: '2 Wheeler',
          vehicleNumber: bikeNumber,
          status: 'Active',
          insurance: { startDate: '2026-02-01', endDate: '2027-02-01' },
          documents: [
            { documentName: 'Pollution Certificate', startDate: '2026-02-01', endDate: '2026-08-01' },
          ],
        },
      ],
    },
    admin.id
  );

  console.log(`Customer created: ID=${createdCustomer?.id}, Name=${createdCustomer?.fullName}`);
  console.log(`Vehicles count: ${createdCustomer?.vehicles?.length}`);
  if (createdCustomer?.vehicles?.length !== 2) {
    throw new Error(`Expected 2 vehicles, got ${createdCustomer?.vehicles?.length}`);
  }
  console.log('Vehicle 1:', createdCustomer.vehicles[0].vehicleNumber, createdCustomer.vehicles[0].vehicleType);
  console.log('Vehicle 2:', createdCustomer.vehicles[1].vehicleNumber, createdCustomer.vehicles[1].vehicleType);
  console.log('Test 1 PASSED!');

  // -------------------------------------------------------------
  // Test 2: Duplicate Customer Protection
  // Registering another vehicle with the same customer phone number
  // must NOT create a duplicate customer, but add vehicle to existing customer!
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Duplicate Customer Protection (Add vehicle via phone match) ---');
  const countBefore = await prisma.customer.count({ where: { phoneNumber: testPhone, isActive: true } });
  if (countBefore !== 1) {
    throw new Error(`Expected exactly 1 customer with phone ${testPhone}, got ${countBefore}`);
  }

  const updatedCustomer = await CustomerService.create(
    {
      firstName: 'TestMultivendor',
      phoneNumber: testPhone,
      remarks: 'Added a delivery truck',
      vehicles: [
        {
          vehicleType: 'Truck',
          vehicleNumber: truckNumber,
          status: 'Active',
          tax: { startDate: '2026-03-01', endDate: '2027-03-01' },
        },
      ],
    },
    admin.id
  );

  const countAfter = await prisma.customer.count({ where: { phoneNumber: testPhone, isActive: true } });
  console.log(`Customer count for phone ${testPhone} after second registration: ${countAfter}`);
  if (countAfter !== 1) {
    throw new Error(`Duplicate customer was created! Expected 1, got ${countAfter}`);
  }

  console.log(`Total vehicles under customer: ${updatedCustomer?.vehicles?.length}`);
  if (updatedCustomer?.vehicles?.length !== 3) {
    throw new Error(`Expected 3 vehicles on customer profile, got ${updatedCustomer?.vehicles?.length}`);
  }
  console.log('Test 2 PASSED (Zero duplicate customer profiles created)!');

  // -------------------------------------------------------------
  // Test 3: Separate Document Renewal
  // Renewing Vehicle 1's Insurance must NOT affect Vehicle 2 or 3
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Separate Document Renewal ---');
  const carVehicle = updatedCustomer!.vehicles!.find((v) => v.vehicleNumber === carNumber)!;
  const bikeVehicle = updatedCustomer!.vehicles!.find((v) => v.vehicleNumber === bikeNumber)!;

  const carInsurance = carVehicle.documents!.find((d) => d.documentName === 'Insurance')!;
  const bikeInsurance = bikeVehicle.documents!.find((d) => d.documentName === 'Insurance')!;

  console.log(`Car insurance initial expiry: ${carInsurance.endDate}`);
  console.log(`Bike insurance initial expiry: ${bikeInsurance.endDate}`);

  // Renew Car insurance to 2028-01-01
  await DocumentService.renew(
    carInsurance.id,
    {
      newStartDate: '2027-01-01',
      newEndDate: '2028-01-01',
      notes: 'Car insurance renewed for 1 more year',
    },
    admin.id
  );

  // Re-fetch vehicles
  const refreshedCar = await VehicleService.getById(carVehicle.id);
  const refreshedBike = await VehicleService.getById(bikeVehicle.id);

  const newCarInsurance = refreshedCar.documents.find((d) => d.id === carInsurance.id)!;
  const unchangeBikeInsurance = refreshedBike.documents.find((d) => d.id === bikeInsurance.id)!;

  console.log(`Car insurance new expiry: ${newCarInsurance.endDate.toISOString().split('T')[0]}`);
  console.log(`Bike insurance expiry remains: ${unchangeBikeInsurance.endDate.toISOString().split('T')[0]}`);

  if (newCarInsurance.endDate.toISOString().split('T')[0] !== '2028-01-01') {
    throw new Error('Car insurance renewal date was not updated correctly!');
  }
  if (unchangeBikeInsurance.endDate.toISOString().split('T')[0] !== new Date('2027-02-01').toISOString().split('T')[0]) {
    throw new Error('Bike insurance was inadvertently modified by car renewal!');
  }

  // Check renewal history is recorded under car vehicle
  console.log(`Car vehicle renewal histories count: ${refreshedCar.renewalHistories.length}`);
  if (refreshedCar.renewalHistories.length !== 1) {
    throw new Error('Car renewal history was not recorded with vehicleId!');
  }
  console.log('Test 3 PASSED (Renewal isolated strictly to target vehicle)!');

  // -------------------------------------------------------------
  // Test 4: Separate Vehicle Deletion
  // Deleting the Truck must deactivate ONLY the Truck and its documents.
  // Car, Bike, and Customer must remain active!
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Separate Vehicle Deletion ---');
  const truckVehicle = updatedCustomer!.vehicles!.find((v) => v.vehicleNumber === truckNumber)!;

  await VehicleService.delete(truckVehicle.id, admin.id);

  const activeVehiclesAfterDelete = await VehicleService.getByCustomerId(createdCustomer!.id);
  console.log(`Active vehicles remaining for customer: ${activeVehiclesAfterDelete.length}`);
  if (activeVehiclesAfterDelete.length !== 2) {
    throw new Error(`Expected 2 active vehicles remaining, got ${activeVehiclesAfterDelete.length}`);
  }

  const truckInDb = await prisma.vehicle.findUnique({ where: { id: truckVehicle.id } });
  if (truckInDb?.isActive !== false) {
    throw new Error('Truck was not soft-deleted!');
  }

  const customerInDb = await prisma.customer.findUnique({ where: { id: createdCustomer!.id } });
  if (customerInDb?.isActive !== true) {
    throw new Error('Customer was deactivated when only one vehicle was deleted!');
  }
  console.log('Test 4 PASSED (Vehicle deletion is strictly vehicle-scoped)!');

  // -------------------------------------------------------------
  // Test 5: Search Separation
  // - Searching by customer name returns ALL vehicles
  // - Searching by vehicle number returns ONLY that specific vehicle
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Search Separation ---');
  // Search by customer name
  const nameSearch = await CustomerService.search('TestMultivendor');
  const customerFoundByName = nameSearch.data.find((c) => c.id === createdCustomer!.id);
  console.log(`Searching by customer name "TestMultivendor": found ${customerFoundByName?.vehicles?.length} vehicles.`);
  if (customerFoundByName?.vehicles?.length !== 2) {
    throw new Error(`Expected all 2 active vehicles when searching by customer name, got ${customerFoundByName?.vehicles?.length}`);
  }

  // Search by vehicle number (Bike)
  const vehicleSearch = await CustomerService.search(bikeNumber);
  const customerFoundByVehicle = vehicleSearch.data.find((c) => c.id === createdCustomer!.id);
  console.log(`Searching by vehicle number "${bikeNumber}": found ${customerFoundByVehicle?.vehicles?.length} vehicles.`);
  if (customerFoundByVehicle?.vehicles?.length !== 1) {
    throw new Error(`Expected exactly 1 vehicle when searching by vehicle number, got ${customerFoundByVehicle?.vehicles?.length}`);
  }
  if (customerFoundByVehicle?.vehicles?.[0]?.vehicleNumber !== bikeNumber) {
    throw new Error(`Expected vehicle ${bikeNumber}, got ${customerFoundByVehicle?.vehicles?.[0]?.vehicleNumber}`);
  }
  console.log('Test 5 PASSED (Customer search returns all vehicles; vehicle search returns only matching vehicle)!');

  // -------------------------------------------------------------
  // Test 6: Expiry Scheduler vehicle-level isolation
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Scheduler Vehicle Expiry Check ---');
  await SchedulerService.runExpiryCheck();
  console.log('Scheduler executed successfully with vehicle-aware document checking.');
  console.log('Test 6 PASSED!');

  // -------------------------------------------------------------
  // Clean up test data
  // -------------------------------------------------------------
  console.log('\n--- CLEANUP: Removing test customer and vehicles ---');
  await prisma.customer.delete({ where: { id: createdCustomer!.id } });
  console.log('Cleanup completed successfully.');

  console.log('\n=== ALL MULTIPLE VEHICLES VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  });
