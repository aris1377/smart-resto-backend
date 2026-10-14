import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BypassTransform } from '../../common/decorators/bypass-transform.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces';
import { QrService } from './qr.service';
import { TableService } from './table.service';
import { TableStatusService } from './table-status.service';
import {
  CreateTableDto,
  ListTablesDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto';

@ApiBearerAuth()
@Controller('tables')
export class TableController {
  constructor(
    private readonly tableService: TableService,
    private readonly tableStatusService: TableStatusService,
    private readonly qrService: QrService,
  ) {}

  // O'qish — restorandagi hamma rol: ofitsiant stol tanlaydi, oshxona ko'radi
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTablesDto) {
    return this.tableService.list(user, query);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tableService.getOne(user, id);
  }

  /**
   * Chop etish uchun QR rasm.
   * JSON emas, PNG qaytadi — shuning uchun `@BypassTransform()`:
   * aks holda `TransformInterceptor` rasmni javob konvertiga o'rab yuborardi.
   */
  @Roles(Role.OWNER, Role.MANAGER)
  @BypassTransform()
  @ApiProduces('image/png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  @Get(':id/qr')
  async getQr(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const table = await this.tableService.getOne(user, id);
    const png = await this.qrService.toPng(table.qrCodeToken);

    return new StreamableFile(png);
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTableDto) {
    return {
      message: 'Stol qoʻshildi.',
      data: await this.tableService.create(user, dto),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTableDto,
  ) {
    return {
      message: 'Stol yangilandi.',
      data: await this.tableService.update(user, id, dto),
    };
  }

  /**
   * Bron qilish va bo'shatish — ofitsiant ham qila oladi.
   * `OCCUPIED` / `BILL_REQUESTED` bu yerdan qo'yilmaydi: ular buyurtma
   * bilan birga o'zgaradi (Faza 5 va 7).
   */
  @Roles(Role.OWNER, Role.MANAGER, Role.WAITER)
  @Patch(':id/status')
  async setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return {
      message: 'Stol holati yangilandi.',
      data: await this.tableStatusService.setManually(user, id, dto.status),
    };
  }

  @Roles(Role.OWNER, Role.MANAGER)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      message: 'Stol oʻchirildi.',
      data: await this.tableService.remove(user, id),
    };
  }
}
