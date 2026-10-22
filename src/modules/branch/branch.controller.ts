import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { BranchService } from './branch.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@ApiBearerAuth()
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  // O'qish — OWNER va MANAGER. Ofitsiant filial sozlamalariga qaramaydi.
  @Roles(Role.OWNER, Role.MANAGER)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.branchService.list(user);
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.branchService.getOne(user, id);
  }

  // Yozish — faqat egasi. Filial ochish pul masalasi (tarif chegarasi).
  @Roles(Role.OWNER)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return {
      message: 'Filial ochildi.',
      data: await this.branchService.create(user, dto),
    };
  }

  @Roles(Role.OWNER)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBranchDto,
  ) {
    return {
      message: 'Filial yangilandi.',
      data: await this.branchService.update(user, id, dto),
    };
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const result = await this.branchService.remove(user, id);

    return {
      message:
        result.deactivatedUsers > 0
          ? `Filial oʻchirildi. ${result.deactivatedUsers} ta xodim nofaol qilindi.`
          : 'Filial oʻchirildi.',
      data: result,
    };
  }
}
