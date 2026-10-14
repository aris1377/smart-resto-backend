import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Fayl saqlash — menyu rasmlari bugun, Faza 4 dagi QR rasmlari va
 * Faza 8 dagi cheklar ertaga shu yerdan foydalanadi.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
