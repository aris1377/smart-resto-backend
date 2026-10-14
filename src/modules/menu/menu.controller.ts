import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { BranchScopeQueryDto } from './dto';
import { MenuService } from './menu.service';

@ApiBearerAuth()
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /** Filialning to'liq menyusi — kategoriyalar, taomlar va mavjudlik */
  @Get()
  getMenu(@CurrentUser() user: AuthUser, @Query() query: BranchScopeQueryDto) {
    return this.menuService.getMenu(user, query);
  }
}
