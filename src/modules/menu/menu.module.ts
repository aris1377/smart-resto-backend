import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { StopListController } from './stop-list.controller';
import { StopListService } from './stop-list.service';

/**
 * Menyu — kategoriya, mahsulot, stop-list va yig'ilgan menyu.
 * `BranchScopeService` (CommonModule) va `StorageService` (StorageModule)
 * @Global bo'lgani uchun bu yerda import qilinmaydi.
 */
@Module({
  controllers: [
    CategoryController,
    ProductController,
    StopListController,
    MenuController,
  ],
  providers: [CategoryService, ProductService, StopListService, MenuService],
  // Faza 5 dagi QR oqimi menyuni shu servis orqali oladi
  exports: [MenuService],
})
export class MenuModule {}
