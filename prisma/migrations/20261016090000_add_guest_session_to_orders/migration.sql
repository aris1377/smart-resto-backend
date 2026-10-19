-- QR mijozining anonim sessiyasi: buyurtmani brauzerga bog'laydi (Faza 5)
ALTER TABLE "orders" ADD COLUMN "guest_session_id" UUID;

-- Stolning ochiq buyurtmasi har bir QR so'rovida qidiriladi
CREATE INDEX "orders_table_id_status_idx" ON "orders"("table_id", "status");
