-- CreateIndex
CREATE INDEX "categories_branch_id_idx" ON "categories"("branch_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "stop_lists_branch_id_product_id_key" ON "stop_lists"("branch_id", "product_id");
