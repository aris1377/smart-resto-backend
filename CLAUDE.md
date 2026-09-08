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
pnpm test             # jest (hozircha testlar yo'q)

pnpm db:generate      # prisma generate
pnpm db:migrate       # prisma migrate dev  -- nom bilan: --name <aniq_nom>
pnpm db:deploy        # prisma migrate deploy (PRODDA, hech narsa so'ramaydi)
pnpm db:reset         # bazani tozalab, migrationlarni qayta qo'llaydi
pnpm db:studio        # brauzerda baza ko'ruvchi
```

> ⚠️ `prisma/migrations/` dagi fayllarni **hech qachon qo'lda tahrirlamang yoki
> o'chirmang** — ular git'da saqlanadi va prodda ketma-ket qo'llanadi. Sxemani
> o'zgartirish uchun `schema.prisma` ni tahrirlab, **yangi** migration yarating.

## Arxitektura

```
src/
├── main.ts                  # bootstrap: global pipe, filter, interceptor, CORS
├── app.module.ts            # ildiz modul
├── prisma/                  # @Global() PrismaModule + PrismaService
├── auth/strategies/         # jwt.strategy.ts
└── common/
    ├── decorators/          # @CurrentUser(), @Roles()
    ├── guards/              # JwtAuthGuard, RolesGuard
    ├── filters/             # AllExceptionsFilter
    └── interceptors/        # TransformInterceptor
```

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

**Autorizatsiya** — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`.
`RolesGuard` `@Roles` bo'lmasa endpointni ochiq deb hisoblaydi, shuning uchun
himoya kerak joyda dekoratorni unutmang. Foydalanuvchini `@CurrentUser()` yoki
`@CurrentUser('id')` orqali oling.

## Ma'lumotlar bazasi (prisma/schema.prisma)

Ierarxiya: `Tenant → Branch → { Hall → Table, Category → Product, StopList, Order }`.
Buyurtma oqimi: `Order → OrderItem`, `Order → Payment → FiscalReceipt`.

Sxema konventsiyalari (yangi model qo'shganda ham shunday davom eting):

* Model va maydonlar TypeScript tomonda **camelCase**, bazada `@map`/`@@map` orqali
  **snake_case** (masalan `branchId @map("branch_id")`, `@@map("branches")`).
* Pul va miqdorlar — `Decimal` (`@db.Decimal(12,2)` summa, `(10,2)` narx, `(8,2)` miqdor).
  JS `number` ga aylantirmang, `Prisma.Decimal` bilan ishlang.
* `Order`, `OrderItem`, `Payment`, `FiscalReceipt` id'lari — **BigInt**.
  JSON'ga serializatsiya qilishdan oldin `String(id)` ga o'tkazish kerak.
* Ro'yxatga o'xshash maydonlar (`Order.status`, `Table.status`, `Payment.provider`)
  hozircha oddiy `String` — mumkin bo'lgan qiymatlar kod ichida kommentda ko'rsatilgan.
* `Role` va `Unit` — Prisma enum.

## Muhit o'zgaruvchilari

`.env.example` ga qarang: `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`,
`ADMIN_API_KEY`, `REDIS_HOST`, `REDIS_PORT`.

`.env` git'ga tushmaydi. Yangi o'zgaruvchi qo'shsangiz, `.env.example` ni ham yangilang.

## Kod uslubi

* Prettier: `singleQuote: true`, `trailingComma: "all"`.
* ESLint: `typescript-eslint` recommendedTypeChecked; `no-explicit-any` **o'chirilgan**,
  `no-floating-promises` va `no-unsafe-argument` — warning.
* Kod ichidagi kommentlar **o'zbek tilida** yozilgan — shu uslubni saqlang.
* Modul strukturasi NestJS standarti: `<feature>.module.ts`, `.controller.ts`,
  `.service.ts`, `dto/`.

## Loyihaning hozirgi holati

To'liq reja: **`docs/ROADMAP.md`** (git'ga tushmaydi, `.gitignore` da).
13 faza, ~7-9 hafta. **Faza 0 (poydevor) tugagan**, Faza 1 (Auth) navbatda.

### Tayyor (Faza 0)

* `ConfigModule` global, `.env` Joi sxemasi bilan tekshiriladi
  (`src/config/env.validation.ts`). Noto'g'ri env — ilova ko'tarilmaydi.
* Kodda `process.env` **umuman yo'q** — hamma joyda `ConfigService`.
* `@Public()`, `@BypassTransform()`, `@Roles()`, `@CurrentUser()` dekoratorlari.
* `AuthUser` interfeysi (`src/common/interfaces/`) — `req.user` ning yagona ta'rifi.
  Unda `password`/`pinCode` **ataylab yo'q**, `jwt.strategy` ularni `omit` bilan
  bazadan ham olmaydi.
* `/api/v1` prefiks + URI versiyalash.
* `helmet`, CORS cheklovi (`CORS_ORIGINS`), global rate-limit (daqiqasiga 100).
* Swagger `/api/docs` da (prodda o'chirilgan), `nest-cli.json` da swagger plagini
  yoqilgan — DTO'larga `@ApiProperty` yozish **shart emas**.
* Birinchi migration qo'llangan, baza sxema bilan mos.

### Hali yo'q

* **`AuthModule` yo'q** — `jwt.strategy.ts` yozilgan, lekin hech qayerda
  ro'yxatdan o'tkazilmagan. `JwtAuthGuard`/`RolesGuard` ham global emas.
  Bu Faza 1 ning asosiy ishi.
* **Multi-tenancy yo'q** — JWT payload'da `tenantId`/`branchId` yo'q, so'rovlar
  `branchId` bo'yicha filtrlanmaydi. Faza 1 gacha har qanday biznes-kod yozishda
  buni yodda tuting.
* Biznes-modullar (menyu, stol, order, to'lov, ombor, xodim) — hech biri yo'q.
* Ombor, davomat, obuna va push uchun **sxemada model ham yo'q** — ular
  `ROADMAP.md` ning 2-bo'limida ta'riflangan.
* Redis env o'zgaruvchilari bor, lekin paket o'rnatilmagan (Faza 6).
* `test/` papkasi yo'q, birorta `.spec.ts` yozilmagan (Faza 12).
* `app.controller.ts` / `app.service.ts` — NestJS shabloni ("Hello World").
* `tsconfig.json` da strict rejim **o'chirilgan** (`strictNullChecks: false`,
  `noImplicitAny: false`). Buning o'rnini ESLint'ning `recommendedTypeChecked`
  to'plami qoplaydi — u `any` oqimini tutadi, shuning uchun **yumshatmang**.

## Git

* Asosiy branch — `master`, ishchi branch — `developer`.
* Conventional commit ishlating: `feat:`, `fix:`, `refactor:`, `chore:`.
