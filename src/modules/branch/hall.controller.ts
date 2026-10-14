import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BranchScopeQueryDto } from '../../common/dto';
import { AuthUser } from '../../common/interfaces';
import { HallService } from './hall.service';
import { CreateHallDto, UpdateHallDto } from './dto';

@ApiBearerAuth()
@Controller('halls')
export class HallController {
  constructor(private readonly hallService: HallService) {}

  // O'qish — restorandagi hamma rol: ofitsiant zal bo'yicha stol tanlaydi
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: BranchScopeQueryDto) {
    return this.hallService.list(user, query);
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateHallDto) {
    return {
      message: 'Zal yaratildi.',
      data: await this.hallService.create(user, dto),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHallDto,
  ) {
    return {
      message: 'Zal yangilandi.',
      data: await this.hallService.update(user, id, dto),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      message: 'Zal oʻchirildi.',
      data: await this.hallService.remove(user, id),
    };
  }
}
