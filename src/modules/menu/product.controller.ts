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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { MAX_IMAGE_BYTES } from '../storage/storage.service';
import { ProductService } from './product.service';
import { CreateProductDto, ListProductsDto, UpdateProductDto } from './dto';

@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProductsDto) {
    return this.productService.list(user, query);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.productService.getOne(user, id);
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return {
      message: 'Mahsulot yaratildi.',
      data: await this.productService.create(user, dto),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return {
      message: 'Mahsulot yangilandi.',
      data: await this.productService.update(user, id, dto),
    };
  }

  /** Menyudan olib qo'yish (yozuv o'chmaydi — order tarixi saqlanadi) */
  @Roles(Role.OWNER, Role.MANAGER)
  @Delete(':id')
  async deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      message: 'Mahsulot menyudan olib qoʻyildi.',
      data: await this.productService.deactivate(user, id),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  // Hajm chegarasi multer darajasida: usiz katta fayl to'liq xotiraga o'qilardi
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @Post(':id/image')
  async setImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return {
      message: 'Rasm yuklandi.',
      data: await this.productService.setImage(user, id, file),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Delete(':id/image')
  async removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      message: 'Rasm oʻchirildi.',
      data: await this.productService.removeImage(user, id),
    };
  }
}
