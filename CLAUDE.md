# CLAUDE.md

Bu fayl ushbu repozitoriyada ishlayotgan Claude Code uchun yo'riqnoma.

## Loyiha haqida

**smart-resto-backend** — restoranlar uchun ko'p ijarali (multi-tenant) SaaS backend.
POS (ofitsiant/kassir), QR orqali mijoz buyurtmasi, oshxona ekrani, to'lov va
fiskallashtirish oqimlarini qamrab oladi.

Texnologiyalar: **NestJS 11**, **Prisma 6.4.1 + PostgreSQL**, **Passport JWT**, **pnpm**.

## Buyruqlar

Paket menejeri — **pnpm** (`pnpm-lock.yaml` mavjud, npm/yarn ishlatilmasin).

```bash
pnpm start:dev        # watch rejimida ishga tushirish
pnpm build            # nest build -> dist/
pnpm start:prod       # node dist/main
pnpm lint             # eslint --fix (type-checked qoidalar yoqilgan)
pnpm format           # prettier --write
pnpm test             # jest (hozircha birorta .spec.ts yo'q)
pnpm test -- src/modules/auth/auth.service.spec.ts   # bitta fayl
pnpm test -- -t "login"                      # nomi mos bitta test

pnpm db:generate      # prisma generate
pnpm db:migrate       # prisma migrate dev  -- nom bilan: --name <aniq_nom>
pnpm db:deploy        # prisma migrate deploy (PRODDA, hech narsa so'ramaydi)
pnpm db:reset         # bazani tozalab, migrationlarni qayta qo'llaydi
pnpm db:studio        # brauzerda baza ko'ruvchi
pnpm db:seed          # demo tenant/filial/xodimlar/menyu (prisma/seed.ts, idempotent)

docker compose up -d minio   # rasm saqlash uchun MinIO (9200 API, 9201 konsol)
```

> `pnpm db:migrate` (`prisma migrate dev`) **interaktiv** — ba'zi o'zgarishlarda
> tasdiq so'raydi. Agar terminal interaktiv bo'lmasa, muqobil yo'l:
> `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script`
> bilan SQL olinadi, yangi migration papkasiga yoziladi va `pnpm db:deploy` qo'llaydi.

> ⚠️ `prisma/migrations/` dagi fayllarni **hech qachon qo'lda tahrirlamang yoki
> o'chirmang** — ular git'da saqlanadi va prodda ketma-ket qo'llanadi. Sxemani
> o'zgartirish uchun `schema.prisma` ni tahrirlab, **yangi** migration yarating.

Jest konfiguratsiyasi `package.json` ichida: `rootDir: "src"`, `testRegex:
".*\\.spec\\.ts$"`. Ya'ni test fayllari **`src/` ichida, tekshirilayotgan
faylning yonida** turadi (`test/` papkasi umuman yo'q). `pnpm test:e2e`
`./test/jest-e2e.json` ni izlaydi — u fayl hali yaratilmagan, shuning uchun
buyruq hozircha ishlamaydi.

## Arxitektura

```
src/
├── main.ts                  # bootstrap: helmet, prefix+versioning, pipe, CORS, Swagger
├── app.module.ts            # ildiz modul: ConfigModule, Throttler, Prisma, Auth
├── config/env.validation.ts # .env uchun Joi sxemasi
├── prisma/                  # @Global() PrismaModule + PrismaService
├── modules/                 # biznes-modullar shu yerda
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── hash.service.ts  # bcrypt (parol/PIN) + sha256 (refresh token)
│   │   ├── dto/
│   │   ├── interfaces/      # AuthTokens, JwtPayload (faqat auth ishlatadi)
│   │   └── strategies/      # jwt.strategy.ts
│   ├── branch/              # Faza 4: filial -> zal -> stol + QR
│   │   ├── branch.controller.ts / .service.ts   # filial CRUD + maxBranches
│   │   ├── hall.controller.ts / .service.ts
│   │   ├── table.controller.ts / .service.ts
│   │   ├── table-status.service.ts   # status o'tishlarining yagona joyi
│   │   ├── qr.service.ts             # QR havolasi va PNG
│   │   └── dto/
│   ├── menu/                # Faza 3: kategoriya, mahsulot, stop-list, menyu
│   │   ├── category.controller.ts / .service.ts
│   │   ├── product.controller.ts / .service.ts   # + rasm yuklash
│   │   ├── stop-list.controller.ts / .service.ts
│   │   ├── menu.controller.ts / .service.ts      # GET /menu
│   │   └── dto/
│   ├── storage/             # @Global() StorageService — S3/MinIO
│   └── platform/            # C qatlam: faqat SUPER_ADMIN
│       ├── platform.controller.ts
│       ├── platform.service.ts      # tenant CRUD, statistika
│       ├── plan.service.ts          # tarif CRUD
│       ├── subscription.controller.ts  # GET /subscription/me (B qatlam)
│       ├── subscription.service.ts  # obuna berish + assertActive()
│       ├── subscription.cron.ts     # kunlik muddat tekshiruvi
│       ├── guards/          # SubscriptionGuard (APP_GUARD)
│       └── dto/
└── common/
    ├── dto/                 # BranchScopeQueryDto (?branchId)
    ├── services/            # @Global() BranchScopeService
    ├── decorators/          # @Public(), @BypassTransform(), @Roles(), @CurrentUser(), @AllowExpired()
    ├── guards/              # JwtAuthGuard, RolesGuard
    ├── filters/             # AllExceptionsFilter
    ├── interceptors/        # TransformInterceptor
    └── interfaces/          # AuthUser
```

Yangi biznes-modul `src/modules/<feature>/` da yaratiladi. `common/` faqat
hamma modul ishlatadigan narsalar uchun (`AuthUser`, guardlar, dekoratorlar);
bitta modulga tegishli tip o'sha modulning `interfaces/` papkasida qoladi.

Global provayderlar `app.module.ts` da `APP_FILTER` / `APP_GUARD` / `APP_INTERCEPTOR`
orqali ulanadi. `APP_GUARD` tartibi **muhim**: `ThrottlerGuard` -> `JwtAuthGuard`
-> `RolesGuard` -> `SubscriptionGuard` (arzon tekshiruv oldinda; oxirgisi
`req.user.tenantId` ga muhtoj).

**Filial doirasi (eng muhim qoida)** — restoran ma'lumoti bilan ishlaydigan
har bir service `BranchScopeService` dan boshlanadi:

* `resolve(user, dto.branchId)` — ro'yxat va yaratishda. Xodim uchun tokendagi
  filial; OWNER uchun so'ralgan filial, lekin u shu tenantga tegishliligi
  tekshiriladi (begona filial — **404**, 403 emas: mavjudligini ham oshkor
  qilmaymiz). OWNER `branchId` bermasa — **400**.
* `assertAccess(user, entity.branchId)` — mavjud yozuv ustidagi amallarda
  (`PATCH /categories/5`), filial yozuvning o'zidan olinadi.

Sehr yo'q: `where: { branchId }` har bir service'da ko'rinib turadi.

**Pagination konventsiyasi** — ro'yxat qaytaradigan har bir endpoint
`{ items, meta: { page, limit, total, totalPages } }` qaytaradi, so'rov esa
`?page=&limit=` oladi (`ListTenantsDto` namuna).

### Global konventsiyalar

**Response formati** — `TransformInterceptor` barcha muvaffaqiyatli javoblarni
o'raydi, controller faqat toza ma'lumot (yoki `{ message, data }`) qaytarsin:

```json
{ "success": true, "statusCode": 200, "message": "Success", "data": {}, "timestamp": "..." }
```

**Xatolik formati** — `AllExceptionsFilter` global, qo'lda try/catch bilan
javob shakllantirmang, oddiy `HttpException` (`NotFoundException` va h.k.) tashlang:

```json
{ "success": false, "statusCode": 404, "path": "/...", "message": "...", "timestamp": "..." }
```

**Validatsiya** — global `ValidationPipe` `whitelist: true`,
`forbidNonWhitelisted: true`, `transform: true` bilan yoqilgan. Ya'ni DTO'da
e'lon qilinmagan har qanday maydon **400** xatolik beradi. Har bir endpoint
uchun `class-validator` dekoratorli DTO yozish majburiy.

**Prisma** — `PrismaModule` `@Global()`, shuning uchun uni har bir modulga
import qilish shart emas, faqat konstruktorda `private readonly prisma: PrismaService`
deb in'ektsiya qiling.

**Autorizatsiya** — `JwtAuthGuard` va `RolesGuard` **global**, ya'ni har bir
endpoint sukut bo'yicha yopiq. `@UseGuards(...)` yozish shart emas:

* ochiq qilish uchun — `@Public()` (QR mijoz endpointlari, login, health-check);
* rol cheklovi uchun — `@Roles(Role.OWNER, Role.MANAGER)`. `@Roles` yozilmasa,
  token bo'lgan **har qanday** foydalanuvchi kira oladi;
* foydalanuvchini `@CurrentUser()` yoki `@CurrentUser('id')` orqali oling.

**Obuna** — `SubscriptionGuard` obunasi tugagan tenantga **402** beradi
(bloklangan tenantga — **403**). Istisno kerak bo'lsa `@AllowExpired()`:
ochiq orderni yopish va to'lov qabul qilish obunasiz ham ishlashi kerak
(Faza 7-8), `/auth/me` ham shunday — frontend avval "kimsan" deb so'raydi.
`@Public()` endpointlarda `req.user` yo'q, shuning uchun QR oqimi tekshiruvni
service ichida `SubscriptionService.assertActive(tenantId)` bilan qiladi.

## Ma'lumotlar bazasi (prisma/schema.prisma)

Ierarxiya: `Tenant → Branch → { Hall → Table, Category → Product, StopList, Order }`.
Buyurtma oqimi: `Order → OrderItem`, `Order → Payment → FiscalReceipt`.

Sxema konventsiyalari (yangi model qo'shganda ham shunday davom eting):

* Model va maydonlar TypeScript tomonda **camelCase**, bazada `@map`/`@@map` orqali
  **snake_case** (masalan `branchId @map("branch_id")`, `@@map("branches")`).
* Pul va miqdorlar — `Decimal` (`@db.Decimal(12,2)` summa, `(10,2)` narx, `(8,2)` miqdor).
  JS `number` ga aylantirmang, `Prisma.Decimal` bilan ishlang.
* Barcha modellarning id'lari — `Int @default(autoincrement())` (BigInt ishlatilmagan).
* `User` — autentifikatsiya markazi: `password` (Owner/Manager/SuperAdmin uchun)
  va `pinCode` (Waiter/Cashier/Kitchen uchun) ikkalasi ham **nullable**, ya'ni
  rolga qarab bittasi to'ldiriladi. `tenantId`/`branchId` ham nullable
  (SUPER_ADMIN hech qaysi tenantga bog'lanmaydi).
* `RefreshToken` — faqat `tokenHash` (sha256, unique) saqlanadi, xom token emas.
  Bekor qilish `revokedAt` ni to'ldirish orqali (qator o'chirilmaydi).
* Ro'yxatga o'xshash maydonlar (`Order.status`, `Table.status`, `Payment.provider`)
  hozircha oddiy `String` — mumkin bo'lgan qiymatlar kod ichida kommentda ko'rsatilgan.
* Menyu ierarxiyasi: `Branch -> Category -> Product`. Mahsulotning filiali
  **kategoriyasi orqali** aniqlanadi (`where: { category: { branchId } }`).
* `Product.isActive: false` — menyudan olib qo'yish. **Hard delete qilinmaydi**:
  `OrderItem -> Product` bog'lanishi `Cascade`, ya'ni o'chirish sotilgan
  taomlarni order tarixidan yechib yuborardi. Kategoriya esa faqat **bo'sh**
  bo'lsa o'chiriladi (aks holda 409).
* `StopList` — vaqtinchalik va filialga xos ("taom tugadi"), `isActive` esa
  doimiy. `@@unique([branchId, productId])` tufayli upsert xavfsiz.
* `Role`, `Unit`, `SubscriptionStatus`, `InvoiceStatus`, `TableStatus` — Prisma enum.
  **Yangi modellarda status'ni boshidan enum qiling** (eski `String` maydonlar
  Faza 4/7/8 da enumga o'tkaziladi).
* Obuna: `Plan` -> `Subscription` -> `TenantInvoice`. Uzaytirish **yangi qator**
  yaratadi (to'lov tarixi), hozirgi obuna = `expiresAt` eng kattasi.
  `Tenant.isActive` obunadan alohida: u shartnoma holati.
* **Narx uch qavatli**: `Plan.priceMonthly` (ro'yxat narxi) ->
  `Subscription.priceMonthly` (shu restoran bilan kelishilgani, nullable) ->
  `TenantInvoice.amount` (to'langan summaning o'zgarmas nusxasi). Tarif narxi
  keyin o'zgarsa, eski obuna va hisob-fakturalarga **ta'sir qilmaydi**.
* Pul API'ga ham **matn** bo'lib kiradi (`"300000"`), `number` emas —
  DTO'da `@IsDecimal({ decimal_digits: '0,2' })`.

## Muhit o'zgaruvchilari

Yagona haqiqat manbai — `src/config/env.validation.ts` (Joi):
`NODE_ENV`, `PORT`, `CORS_ORIGINS` (prodda **majburiy**), `DATABASE_URL`,
`JWT_SECRET` (min 32 belgi), `JWT_EXPIRES_IN` (default `15m`),
`REFRESH_TOKEN_EXPIRES_DAYS` (default 7), `ADMIN_API_KEY`,
`THROTTLE_TTL_SECONDS` (default 60) va `THROTTLE_LIMIT` (default 100) —
global rate-limit, `REDIS_HOST`, `REDIS_PORT`,
`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
`S3_PUBLIC_URL` (lokalda `docker-compose.yml` dagi MinIO, port 9200),
`QR_BASE_URL` (stol QR kodi shu manzilga ishora qiladi).

`.env` git'ga tushmaydi. Yangi o'zgaruvchi qo'shsangiz, Joi sxemasini **va**
`.env.example` ni birga yangilang.

## Kod uslubi

* Prettier: `singleQuote: true`, `trailingComma: "all"`.
* ESLint: `typescript-eslint` recommendedTypeChecked; `no-explicit-any` **o'chirilgan**,
  `no-floating-promises` va `no-unsafe-argument` — warning.
* Kod ichidagi kommentlar **o'zbek tilida** yozilgan — shu uslubni saqlang.
* Modul strukturasi NestJS standarti: `<feature>.module.ts`, `.controller.ts`,
  `.service.ts`, `dto/`.

## Loyihaning hozirgi holati

To'liq reja: **`docs/ROADMAP.md`** (git'ga tushmaydi, `.gitignore` da).
13 faza, ~7-9 hafta. **Faza 0, 1, 2, 3 va 4 tugagan**. Navbatda — Faza 5
(mijozning QR oqimi).

### Tayyor (Faza 0)

* `ConfigModule` global, `.env` Joi sxemasi bilan tekshiriladi
  (`src/config/env.validation.ts`). Noto'g'ri env — ilova ko'tarilmaydi.
* Kodda `process.env` **umuman yo'q** — hamma joyda `ConfigService`.
* `@Public()`, `@BypassTransform()`, `@Roles()`, `@CurrentUser()` dekoratorlari.
* `AuthUser` interfeysi (`src/common/interfaces/`) — `req.user` ning yagona ta'rifi.
  Unda `password`/`pinCode` **ataylab yo'q** — `jwt.strategy` ularni `select`
  ro'yxatiga qo'shmaydi, ya'ni bazadan ham olinmaydi (`isActive` esa olinadi,
  tekshirilgach `AuthUser` dan chiqarib tashlanadi).
* `/api/v1` prefiks + URI versiyalash.
* `helmet`, CORS cheklovi (`CORS_ORIGINS`), global rate-limit (daqiqasiga 100).
* Swagger `/api/docs` da (prodda o'chirilgan), `nest-cli.json` da swagger plagini
  yoqilgan — DTO'larga `@ApiProperty` yozish **shart emas**.
* 4 ta migration qo'llangan (oxirgisi `add_subscription_models`), baza sxema bilan mos.

### Tayyor (Faza 1)

* `AuthModule` (`src/modules/auth/`) — `PassportModule` + `JwtModule.registerAsync`,
  provayderlar `JwtStrategy`, `AuthService`, `HashService`.
* 6 ta endpoint: `POST /auth/login` (email+parol), `GET /auth/branches/:id/staff`,
  `POST /auth/login-pin`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
  `/auth/me` dan boshqa hammasi `@Public()`, login endpointlarida
  `@Throttle` bilan daqiqasiga 5 ta urinish.
* **PIN login ikki bosqichli** — bcrypt tasodifiy tuz ishlatadi, ya'ni PIN hashini
  qidirib bo'lmaydi. Avval xodim tanlanadi, keyin bitta solishtirish qilinadi.
* **Refresh token rotatsiyasi** — bazada faqat sha256 hash, ishlatilgan token
  darhol `revokedAt` bilan yopiladi, `logout` `updateMany` tufayli idempotent.
* Login xatolarida "email topilmadi" va "parol xato" **bir xil xabar** beradi
  (user enumeration'ning oldini olish).
* `prisma/seed.ts` — demo tenant, filial va 6 xodim (3 parolli, 3 PIN'li).
  `tsconfig.build.json` da `prisma` exclude qilingan, aks holda `nest build`
  natijasi `dist/src/main.js` ga surilib ketadi.

### Tayyor (Faza 2)

* `PlatformModule` — `/api/v1/platform/*`, klass darajasida `@Roles(SUPER_ADMIN)`:
  `GET tenants` (pagination+filtr+qidiruv), `GET tenants/:id`, `POST tenants`,
  `PATCH tenants/:id/status`, `POST tenants/:id/subscription`,
  `GET/POST plans`, `PATCH plans/:id`, `GET stats`.
* `GET /subscription/me` — **B qatlam**: OWNER/MANAGER o'z obunasini ko'radi
  (tarif, tugash sanasi, `daysLeft`, `usage` va `limits`). `@AllowExpired()` —
  obuna tugaganda ham ochiq bo'lishi shart, aks holda foydalanuvchi 402 dan
  boshqa hech narsa ko'rmaydi. `tenantId` so'rovdan emas, tokendan olinadi.
* `POST /platform/tenants` — tenant + birinchi OWNER bitta `$transaction`
  ichida. Parol tranzaksiyadan **tashqarida** hashlanadi. Filial bu yerda
  ochilmaydi: u OWNER ning ishi (Faza 4), aks holda obuna va `maxBranches`
  tekshiruvlari chetlab o'tilardi.
* `SubscriptionGuard` global (4-guard), `@AllowExpired()` bilan istisno.
* `SubscriptionCron` — har kuni 03:00 da muddati o'tganlarni `EXPIRED` qiladi va
  3 kun qolganlarni logga yozadi. ⚠️ Bir nechta instansiyada har birida ishlaydi
  (Faza 12 da lock kerak).
* `AllExceptionsFilter` endi kutilmagan xatoning matnini mijozga **chiqarmaydi**
  (faqat logga), oldin `error.message` javobga tushardi.
* Obuna berishda narx: `dto.priceMonthly` -> o'sha tarifdagi oldingi kelishuv ->
  tarif narxi. Ya'ni "sizga 100 mingga" deb kelishilgan restoran uzaytirilganda
  jimgina to'liq narxga o'tib ketmaydi.
* `Plan.maxBranches`/`maxUsers` **hali tekshirilmaydi** — tekshiruv cheklov
  buziladigan joyda yoziladi: filial Faza 4 da, xodim Faza 10 da.
* Seed: 3 ta tarif + demo tenantga 1 yillik faol obuna (usiz hamma endpoint 402).

### Tayyor (Faza 3)

* `MenuModule` (`src/modules/menu/`) — 14 endpoint:
  `GET/POST /categories`, `PATCH/DELETE /categories/:id`,
  `GET /products` (pagination, `?categoryId`, `?search`, `?includeInactive`),
  `GET/POST /products`, `PATCH/DELETE /products/:id`,
  `POST/DELETE /products/:id/image`, `GET/PUT /stop-list`, `GET /menu`.
* **`BranchScopeService`** (`src/common/services/`) — filial doirasi shu yerda
  hal qilinadi, Faza 4-11 dagi har bir modul shuni chaqiradi.
* Rollar: menyu yozuvi — OWNER/MANAGER; o'qish — restorandagi hamma rol;
  stop-list — OWNER/MANAGER/**KITCHEN** (taom tugaganini oshxona biladi).
* `StorageModule` (`@Global()`) — S3/MinIO. Fayl nomi **serverda** generatsiya
  qilinadi (`products/<id>/<uuid>.jpg`), mijozning fayl nomiga ishonilmaydi.
  Ruxsat: JPEG/PNG/WebP, 5 MB. Rasm almashtirilganda eskisi xotiradan o'chadi.
  Bucket ilova ko'tarilganda avtomatik yaratiladi va ochiq o'qishga sozlanadi.
* `tsconfig.json` da `types: ["node", "express", "multer"]` — `Express.Multer.File`
  tipi shusiz topilmaydi.
* Seed'da demo menyu: 3 kategoriya, 8 taom.
* Redis cache (`GET /menu`) **ataylab kechiktirildi** — roadmapning texnologiyalar
  jadvalida `ioredis` Faza 6 da. Menyu hozir 2 ta parallel so'rov bilan
  quriladi (N+1 yo'q).

### Yuk testi natijalari (2026-10-14, dev noutbuk, localhost)

`autocannon`, 10 soniya, `GET /menu`. Raqamlar **nisbatlar uchun**, prodda
boshqacha bo'ladi:

| Holat | Ulanish | p50 | Req/sek |
|---|---:|---:|---:|
| 8 taom (1.4 KB) | 10 / 50 / 100 | 8 / 34 / 69 ms | 1159 / 1399 / 1410 |
| 158 taom (38 KB) | 10 / 50 / 100 | 13 / 62 / 130 ms | 752 / 795 / 750 |
| 158 taom + 60s xotira-cache | 10 / 50 / 100 | 8 / 36 / 69 ms | 1186 / 1340 / 1398 |

Bazaning o'zi (menyuning 2 ta so'rovi) — 8 taomda `p50 = 0.67 ms`, 158 taomda
`p50 = 2.08 ms`. Ya'ni 13 ms lik javobning atigi ~16% i baza; qolgani JWT,
Prisma natijasini obyektga aylantirish (`Decimal`lar) va JSON yasash.

Shundan kelib chiqqan qarorlar Faza 6 uchun:

* Cache **~1.75 barobar** beradi, lekin foyda bazaning sekinligidan emas —
  takrorlanadigan **protsessor ishidan** keladi (Node bitta oqimda).
* Cache'da **JSON matni** saqlansin, obyekt emas — shunda `JSON.stringify`
  ham tejaladi (o'lchangan 1.75 — pastki chegara).
* Avval `Cache-Control` sarlavhalari: so'rov ilovaga umuman kirmaydi.
* Menyu tuzilishi uzoq, stop-list qisqa (yoki umuman cache'siz) — ular
  turli tezlikda o'zgaradi.
* Cache faqat **ko'rsatish** uchun. Order narxi (Faza 7) har doim bazadan
  qayta o'qiladi va `OrderItem` ga nusxa qilinadi.

### Tayyor (Faza 4)

* `BranchModule` (`src/modules/branch/`) — 16 endpoint:
  `GET/POST /branches`, `GET/PATCH/DELETE /branches/:id`,
  `GET/POST /halls`, `PATCH/DELETE /halls/:id`,
  `GET/POST /tables`, `GET/PATCH/DELETE /tables/:id`,
  `GET /tables/:id/qr`, `PATCH /tables/:id/status`.
* Ierarxiya: **filial -> zal -> stol**. Stolning filiali **zali orqali**
  aniqlanadi (mahsulotning filiali kategoriyasi orqali aniqlangani kabi),
  shuning uchun `POST /tables` da `branchId` yo'q.
* `BranchService` `BranchScopeService` ni **ishlatmaydi**: u filial *ichidagi*
  ma'lumot uchun. Filialning o'zi bir pog'ona yuqori — doira `tenantId`.
  MANAGER tokenida `branchId` bor, shuning uchun u faqat o'z filialini ko'radi.
* **`maxBranches` endi kuchda**: `SubscriptionService.assertCanAddBranch()`
  `POST /branches` da chaqiriladi. Qoida obuna ma'lumotining yonida turadi,
  filial moduli tarif haqida hech narsa bilmaydi. `maxUsers` — Faza 10 da.
* `TableStatus` enum (`FREE`, `OCCUPIED`, `RESERVED`, `BILL_REQUESTED`).
  **Qo'lda faqat `FREE` va `RESERVED` qo'yiladi** — `OCCUPIED` va
  `BILL_REQUESTED` ortida haqiqiy buyurtma turishi kerak, ularni Faza 5/7
  dagi order oqimi `TableStatusService.applyOrderEvent(tableId, status, tx)`
  orqali qo'yadi (`tx` — chaqiruvchining tranzaksiyasi).
  Ochiq buyurtmasi bor stolni qo'lda `FREE` qilib bo'lmaydi.
* `qrCodeToken` — `randomUUID()`, **serverda** yaratiladi va hech qachon
  o'zgartirilmaydi: u allaqachon stolga yopishtirilgan qog'ozda chop etilgan.
  `GET /tables/:id/qr` PNG qaytaradi (`@BypassTransform()` + `StreamableFile`),
  QR ichida to'liq havola: `<QR_BASE_URL>/<token>`.
* O'chirish qoidalari: filial va stol — **buyurtma tarixi bo'lmasa**
  (`Order -> Branch/Table` bog'lanishi `Cascade`); zal — **bo'sh bo'lsa**.
* Migration `Table.status` ni `DROP COLUMN` bilan emas, `ALTER COLUMN ... USING`
  bilan o'tkazadi — Prisma avtomatik yaratgan variant ma'lumotni yo'qotardi.
* `@@unique([branchId, name])` zalda, `@@unique([hallId, tableNumber])` stolda:
  takrorlanishni kod emas, **baza** to'xtatadi (parallel so'rovlar uchun).
* Seed: "Asosiy zal" + 4 ta stol.

### Hali yo'q

* Biznes-modullar: order, to'lov, ombor, xodim — hali yo'q.
* Ombor, davomat, obuna va push uchun **sxemada model ham yo'q** — ular
  `ROADMAP.md` ning 2-bo'limida ta'riflangan.
* Redis env o'zgaruvchilari bor, lekin paket o'rnatilmagan (Faza 6).
* Birorta `.spec.ts` yozilmagan, `test/jest-e2e.json` ham yo'q (Faza 12).
* `app.controller.ts` / `app.service.ts` — NestJS shabloni ("Hello World").
* `tsconfig.json` da strict rejim **o'chirilgan** (`strictNullChecks: false`,
  `noImplicitAny: false`). Buning o'rnini ESLint'ning `recommendedTypeChecked`
  to'plami qoplaydi — u `any` oqimini tutadi, shuning uchun **yumshatmang**.

## Git

* Asosiy branch — `master`, ishchi branch — `developer`.
* `.claude/skills/prisma-composer/` — `postinstall` dagi `prisma skills sync`
  avtomatik tortadi, loyihaga aloqasi yo'q (bu yerda Prisma Composer emas,
  oddiy Prisma ORM ishlatiladi).
* Conventional commit ishlating: `feat:`, `fix:`, `refactor:`, `chore:`.
