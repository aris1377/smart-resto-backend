import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { GuestSession } from './decorators/guest-session.decorator';
import { GUEST_READ_THROTTLE, GUEST_SESSION_HEADER } from './guest.constants';
import { GuestMenuService } from './guest-menu.service';

/** A qatlam — QR skanerlagan mehmon. Token ham, login ham yo'q */
@Public()
@Controller('public/qr')
export class GuestMenuController {
  constructor(private readonly guestMenuService: GuestMenuService) {}

  /** QR ichidagi havola shu yerga ochiladi: restoran, stol va menyu */
  @Throttle(GUEST_READ_THROTTLE)
  @ApiHeader({ name: GUEST_SESSION_HEADER, required: false })
  @Get(':token')
  getMenu(
    @Param('token', new ParseUUIDPipe({ version: '4' })) token: string,
    @GuestSession({ required: false }) guestSessionId?: string,
  ) {
    return this.guestMenuService.getByToken(token, guestSessionId);
  }
}
