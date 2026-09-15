import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// hash.service.ts dagi bilan bir xil boʻlishi shart
const BCRYPT_ROUNDS = 12;

const TENANT_NAME = 'Demo Resto';
const BRANCH_NAME = 'Markaziy filial';

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  tenantId: number | null;
  branchId: number | null;
  /** OWNER/MANAGER/SUPER_ADMIN — email bilan kiradi */
  password?: string;
  /** WAITER/CASHIER/KITCHEN — planshetda PIN bilan kiradi */
  pinCode?: string;
}

async function main() {
  // Nomi boʻyicha qidiramiz — id qotirilmaydi, aks holda autoincrement buziladi
  const tenant =
    (await prisma.tenant.findFirst({ where: { name: TENANT_NAME } })) ??
    (await prisma.tenant.create({ data: { name: TENANT_NAME } }));

  const branch =
    (await prisma.branch.findFirst({
      where: { tenantId: tenant.id, name: BRANCH_NAME },
    })) ??
    (await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: BRANCH_NAME,
        address: 'Toshkent, Amir Temur koʻchasi 1',
        phone: '+998901234567',
      },
    }));

  const staff: SeedUser[] = [
    {
      name: 'Super Admin',
      email: 'superadmin@smartresto.uz',
      role: Role.SUPER_ADMIN,
      password: 'SuperAdmin123',
      tenantId: null, // platforma egasi — hech qaysi restoranga tegishli emas
      branchId: null,
    },
    {
      name: 'Restoran egasi',
      email: 'owner@smartresto.uz',
      role: Role.OWNER,
      password: 'Owner12345',
      tenantId: tenant.id, // butun biznesga tegishli
      branchId: null,
    },
    {
      name: 'Menejer',
      email: 'manager@smartresto.uz',
      role: Role.MANAGER,
      password: 'Manager12345',
      tenantId: tenant.id,
      branchId: branch.id,
    },
    {
      name: 'Ofitsiant Aziz',
      email: 'waiter@smartresto.uz',
      role: Role.WAITER,
      pinCode: '1234',
      tenantId: tenant.id,
      branchId: branch.id,
    },
    {
      name: 'Kassir Dilnoza',
      email: 'cashier@smartresto.uz',
      role: Role.CASHIER,
      pinCode: '5678',
      tenantId: tenant.id,
      branchId: branch.id,
    },
    {
      name: 'Oshxona',
      email: 'kitchen@smartresto.uz',
      role: Role.KITCHEN,
      pinCode: '9012',
      tenantId: tenant.id,
      branchId: branch.id,
    },
  ];

  for (const person of staff) {
    const { password, pinCode, ...rest } = person;

    const data = {
      ...rest,
      password: password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : null,
      pinCode: pinCode ? await bcrypt.hash(pinCode, BCRYPT_ROUNDS) : null,
      isActive: true,
    };

    // Email unique — seed qayta ishga tushsa dublikat yaratmaydi
    await prisma.user.upsert({
      where: { email: person.email },
      update: data,
      create: data,
    });
  }

  console.log(`Tenant: ${tenant.name} (id=${tenant.id})`);
  console.log(`Branch: ${branch.name} (id=${branch.id})`);
  console.log('');
  console.log('Email bilan kirish (parol):');
  console.log('  superadmin@smartresto.uz  SuperAdmin123');
  console.log('  owner@smartresto.uz       Owner12345');
  console.log('  manager@smartresto.uz     Manager12345');
  console.log('');
  console.log('PIN bilan kirish (planshet):');
  console.log('  Ofitsiant Aziz     1234');
  console.log('  Kassir Dilnoza     5678');
  console.log('  Oshxona            9012');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
