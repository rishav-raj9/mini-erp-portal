import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const users = [
    { name: 'Admin User', email: 'admin@erp.com', role: 'ADMIN' },
    { name: 'Sales Agent', email: 'sales@erp.com', role: 'SALES' },
    { name: 'Warehouse Staff', email: 'warehouse@erp.com', role: 'WAREHOUSE' },
    { name: 'Accounts Officer', email: 'accounts@erp.com', role: 'ACCOUNTS' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: hashedPassword },
    });
  }

  await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      name: 'Industrial Valve A1',
      sku: 'SKU-001',
      category: 'Fittings',
      unitPrice: 450.0,
      currentStock: 20,
      minStockAlert: 5,
      location: 'Warehouse Bay 3',
    },
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());