import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { GuestSession } from './decorators/guest-session.decorator';
import { AddOrderItemsDto, CreateGuestOrderDto } from './dto';
import {
  GUEST_READ_THROTTLE,
  GUEST_SESSION_HEADER,
  GUEST_WRITE_THROTTLE,
} from './guest.constants';
import { GuestOrderService } from './guest-order.service';

/**
 * A qatlam — mehmonning buyurtmasi.
 * Har bir so'rov `X-Guest-Session` sarlavhasini talab qiladi.
 */
@Public()
@ApiHeader({ name: GUEST_SESSION_HEADER, required: true })
@Controller('public/orders')
export class GuestOrderController {
  constructor(private readonly guestOrderService: GuestOrderService) {}

  @Throttle(GUEST_WRITE_THROTTLE)
  @Post()
  async create(
    @Body() dto: CreateGuestOrderDto,
    @GuestSession() guestSessionId: string,
  ) {
    const { created, order } = await this.guestOrderService.create(
      dto,
      guestSessionId,
    );

    return {
      message: created
        ? 'Buyurtma qabul qilindi.'
        : 'Taomlar ochiq buyurtmangizga qoʻshildi.',
      data: order,
    };
  }

  @Throttle(GUEST_READ_THROTTLE)
  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @GuestSession() guestSessionId: string,
  ) {
    return this.guestOrderService.getOne(id, guestSessionId);
  }

  @Throttle(GUEST_WRITE_THROTTLE)
  @Post(':id/items')
  async addItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOrderItemsDto,
    @GuestSession() guestSessionId: string,
  ) {
    return {
      message: 'Taomlar buyurtmaga qoʻshildi.',
      data: await this.guestOrderService.addItems(id, dto, guestSessionId),
    };
  }

  @Throttle(GUEST_WRITE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/request-bill')
  async requestBill(
    @Param('id', ParseIntPipe) id: number,
    @GuestSession() guestSessionId: string,
  ) {
    return {
      message: 'Hisob soʻraldi. Ofitsiant tez orada keladi.',
      data: await this.guestOrderService.requestBill(id, guestSessionId),
    };
  }
}
