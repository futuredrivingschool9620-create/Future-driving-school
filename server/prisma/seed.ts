import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const username = process.env.ADMIN_SEED_USERNAME || 'admin';
  const email = process.env.ADMIN_SEED_EMAIL || 'admin@futuredrivingschool.com';
  const password = process.env.ADMIN_SEED_PASSWORD || 'Admin@123456';

  // Check if admin already exists
  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existing) {
    console.log(`⚠️  Admin user "${existing.username}" already exists. Skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.create({
    data: {
      username,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`✅ Admin user created:`);
  console.log(`   Username: ${admin.username}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role: ${admin.role}`);
  console.log(`   ID: ${admin.id}`);
  console.log('');
  console.log('⚠️  Change the default password after first login!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
