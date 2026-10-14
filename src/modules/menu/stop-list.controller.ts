import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { BranchScopeQueryDto, SetStopListDto } from './dto';
import { StopListService } from './stop-list.service';

@ApiBearerAuth()
@Controller('stop-list')
export class StopListController {
  constructor(private readonly stopListService: StopListService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: BranchScopeQueryDto) {
    return this.stopListService.list(user, query);
  }

  /**
   * KITCHEN ham qila oladi — taom tugaganini birinchi bo'lib oshxona biladi.
   * Lekin narx yoki menyuga oshxona tegolmaydi (rollar matritsasi).
   */
  @Roles(Role.OWNER, Role.MANAGER, Role.KITCHEN)
  @Put(':productId')
  set(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: SetStopListDto,
  ) {
    return this.stopListService.set(user, productId, dto);
  }
}
