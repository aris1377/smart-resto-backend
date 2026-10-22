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
import { AuthUser } from '../../common/interfaces';
import { CategoryService } from './category.service';
import {
  BranchScopeQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';

@ApiBearerAuth()
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // O'qish — restorandagi hamma rolga ochiq (ofitsiant ham menyuni ko'radi)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: BranchScopeQueryDto) {
    return this.categoryService.list(user, query);
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return {
      message: 'Kategoriya yaratildi.',
      data: await this.categoryService.create(user, dto),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return {
      message: 'Kategoriya yangilandi.',
      data: await this.categoryService.update(user, id, dto),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const result = await this.categoryService.remove(user, id);

    return {
      message:
        result.removedProducts > 0
          ? `Kategoriya oʻchirildi. Menyudan olib qoʻyilgan ${result.removedProducts} ta taom ham oʻchdi.`
          : 'Kategoriya oʻchirildi.',
      data: result,
    };
  }
}
