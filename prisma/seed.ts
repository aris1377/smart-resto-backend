import {
  InvoiceStatus,
  PrismaClient,
  Role,
  SubscriptionStatus,
  Unit,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// hash.service.ts dagi bilan bir xil boʻlishi shart
const BCRYPT_ROUNDS = 12;

const TENANT_NAME = 'Demo Resto';
const BRANCH_NAME = 'Markaziy filial';

const PLANS = [
  { name: 'Basic', priceMonthly: 300000, maxBranches: 1, maxUsers: 10 },
  { name: 'Pro', priceMonthly: 700000, maxBranches: 5, maxUsers: 50 },
  { name: 'Enterprise', priceMonthly: 1500000, maxBranches: 50, maxUsers: 500 },
];

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

  // Tariflar — nomi unique, shuning uchun upsert dublikat yaratmaydi
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  const basicPlan = await prisma.plan.findUniqueOrThrow({
    where: { name: 'Basic' },
  });

  // Demo tenantga faol obuna: usiz SubscriptionGuard hamma endpointga 402 beradi
  const now = new Date();
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      tenantId: tenant.id,
      status: SubscriptionStatus.ACTIVE,
      expiresAt: { gt: now },
    },
  });

  if (!activeSubscription) {
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: basicPlan.id,
        startsAt: now,
        expiresAt,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    await prisma.tenantInvoice.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        amount: basicPlan.priceMonthly.mul(12),
        periodFrom: now,
        periodTo: expiresAt,
        status: InvoiceStatus.PAID,
        paidAt: now,
      },
    });
  }

  // Demo menyu: kategoriya -> taomlar. Faza 3 ni test qilish uchun.
  const MENU: { category: string; sortOrder: number; products: { name: string; price: string; description?: string; unit?: Unit; unitValue?: string }[] }[] = [
    {
      category: 'Salatlar',
      sortOrder: 1,
      products: [
        { name: 'Achchiq-chuchuk', price: '18000', description: 'Pomidor, piyoz, achchiq qalampir' },
        { name: 'Sezar', price: '32000' },
      ],
    },
    {
      category: 'Issiq taomlar',
      sortOrder: 2,
      products: [
        { name: 'Osh', price: '35000', description: 'Toshkent oshi' },
        { name: 'Lagmon', price: '30000' },
        { name: 'Kabob', price: '22000', unit: Unit.PIECE, unitValue: '1' },
        { name: 'Goʻsht', price: '145000', unit: Unit.KG, unitValue: '1' },
      ],
    },
    {
      category: 'Ichimliklar',
      sortOrder: 3,
      products: [
        { name: 'Choy', price: '8000' },
        { name: 'Cola 0.5', price: '12000', unit: Unit.ML, unitValue: '500' },
      ],
    },
  ];

  for (const group of MENU) {
    const category =
      (await prisma.category.findFirst({
        where: { branchId: branch.id, name: group.category },
      })) ??
      (await prisma.category.create({
        data: { branchId: branch.id, name: group.category, sortOrder: group.sortOrder },
      }));

    for (const item of group.products) {
      const existing = await prisma.product.findFirst({
        where: { categoryId: category.id, name: item.name },
      });

      if (!existing) {
        await prisma.product.create({
          data: {
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price: item.price,
            unit: item.unit ?? Unit.PIECE,
            unitValue: item.unitValue ?? '1',
          },
        });
      }
    }
  }

  console.log(`Tenant: ${tenant.name} (id=${tenant.id})`);
  console.log(`Branch: ${branch.name} (id=${branch.id})`);
  console.log(`Tariflar: ${PLANS.map((p) => p.name).join(', ')}`);
  console.log('Obuna: Basic, 1 yil, ACTIVE');
  console.log(`Menyu: ${MENU.length} kategoriya, ${MENU.reduce((n, g) => n + g.products.length, 0)} taom`);
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
