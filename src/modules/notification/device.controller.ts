import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeviceService } from './device.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto';

/**
 * Qurilmani push uchun roʻyxatdan oʻtkazish.
 *
 * `@Roles` yoʻq — ataylab: push har qanday xodimga kerak boʻlishi mumkin,
 * kimga nima borishini rol emas, hodisaning oʻzi hal qiladi (`PushService`).
 */
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  register(@CurrentUser('id') userId: number, @Body() dto: RegisterDeviceDto) {
    return this.deviceService.register(userId, dto);
  }

  /** Chiqishda: bu planshetga endi xabar yuborilmaydi */
  @Delete()
  @HttpCode(HttpStatus.OK)
  unregister(
    @CurrentUser('id') userId: number,
    @Body() dto: UnregisterDeviceDto,
  ) {
    return this.deviceService.unregister(userId, dto.token);
  }
}
