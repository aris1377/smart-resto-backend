import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { HallController } from './hall.controller';
import { HallService } from './hall.service';
import { QrService } from './qr.service';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { TableStatusService } from './table-status.service';

/**
 * Filial va uning tuzilmasi: filial -> zal -> stol.
 * `PlatformModule` — tarifdagi `maxBranches` chegarasi uchun.
 */
@Module({
  imports: [PlatformModule],
  controllers: [BranchController, HallController, TableController],
  providers: [
    BranchService,
    HallService,
    TableService,
    TableStatusService,
    QrService,
  ],
  // Faza 5 (QR oqimi) va Faza 7 (order) stol holatini shu orqali o'zgartiradi
  exports: [TableStatusService],
})
export class BranchModule {}
