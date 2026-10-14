import { Global, Module } from '@nestjs/common';
import { BranchScopeService } from './services/branch-scope.service';

/**
 * Hamma biznes-modul ishlatadigan servislar.
 * `PrismaModule` kabi @Global() — har bir modulga import qilib yurilmasin.
 */
@Global()
@Module({
  providers: [BranchScopeService],
  exports: [BranchScopeService],
})
export class CommonModule {}
