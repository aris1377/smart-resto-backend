-- Stol statusi: String -> TableStatus enum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED');

-- Ustun joyida o'zgartiriladi (DROP + ADD emas) — mavjud qiymatlar saqlanadi.
-- Eski qiymatlar kichik harfda edi ('free'), shuning uchun UPPER bilan o'tkaziladi.
ALTER TABLE "tables" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tables"
  ALTER COLUMN "status" TYPE "TableStatus"
  USING (UPPER("status")::"TableStatus");

ALTER TABLE "tables" ALTER COLUMN "status" SET DEFAULT 'FREE';

-- Indekslar: filiallar tenant bo'yicha, zallar filial bo'yicha o'qiladi
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");
CREATE INDEX "halls_branch_id_idx" ON "halls"("branch_id");
CREATE INDEX "tables_hall_id_idx" ON "tables"("hall_id");

-- Takrorlanishning oldini olish
CREATE UNIQUE INDEX "halls_branch_id_name_key" ON "halls"("branch_id", "name");
CREATE UNIQUE INDEX "tables_hall_id_table_number_key" ON "tables"("hall_id", "table_number");
