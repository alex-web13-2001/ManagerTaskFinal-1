import prisma from '../src/server/db';
import bcrypt from 'bcryptjs';

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Admin User';

  console.log('🌱 Seeding database...');

  // Check if admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingUser) {
    console.log('✅ Admin user already exists:', adminEmail);
  } else {

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
      emailVerified: true,
    },
  });
  }



  // Create additional test users
  const testUsers = [
    { email: 'manager@example.com', name: 'Ivan Manager' },
    { email: 'dev@example.com', name: 'Petr Developer' },
    { email: 'designer@example.com', name: 'Anna Designer' },
  ];

  for (const u of testUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await prisma.user.create({
            data: {
                email: u.email,
                name: u.name,
                password: hashedPassword,
                emailVerified: true,
            }
        });
        console.log(`✅ Created test user: ${u.email}`);
    }
  }

  console.log('🎉 Seeding completed successfully!');
}

async function createTestUsers() {
  const users = [
    { email: 'manager@example.com', name: 'Ivan Manager', role: 'owner' },
    { email: 'dev@example.com', name: 'Petr Developer', role: 'member' },
    { email: 'designer@example.com', name: 'Anna Designer', role: 'member' },
  ];

  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await prisma.user.create({
            data: {
                email: u.email,
                name: u.name,
                password: hashedPassword,
                emailVerified: true,
            }
        });
        console.log(`Created test user: ${u.email}`);
    }
  }
}

// Rename main to originalMain or just call createTestUsers inside main
// Let's modify the end of the file instead to keep it clean.


main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
