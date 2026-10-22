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
import { ApiBearerAuth } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { AllowExpired } from '../../common/decorators/allow-expired.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuthService } from './auth.service';
import { LoginDto, LoginPinDto, RefreshTokenDto } from './dto';

// Parol va PIN topishga urinishni cheklaydi (global limit — daqiqasiga 100)
const LOGIN_THROTTLE = { default: { limit: 5, ttl: minutes(1) } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Email + parol — OWNER, MANAGER, SUPER_ADMIN */
  @Public()
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return {
      message: 'Tizimga muvaffaqiyatli kirdingiz.',
      data: await this.authService.login(dto),
    };
  }

  /** PIN loginning 1-bosqichi: planshet filialdagi xodimlarni koʻrsatadi */
  @Public()
  @Get('branches/:branchId/staff')
  getBranchStaff(@Param('branchId', ParseIntPipe) branchId: number) {
    return this.authService.getBranchStaff(branchId);
  }

  /** PIN loginning 2-bosqichi — WAITER, CASHIER, KITCHEN */
  @Public()
  @Throttle(LOGIN_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login-pin')
  async loginWithPin(@Body() dto: LoginPinDto) {
    return {
      message: 'Tizimga muvaffaqiyatli kirdingiz.',
      data: await this.authService.loginWithPin(dto),
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return {
      message: 'Token yangilandi.',
      data: await this.authService.refresh(dto),
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto);
    return { message: 'Tizimdan chiqdingiz.', data: null };
  }

  /** Yagona himoyalangan endpoint — tokenni tekshirish uchun ham qulay */
  // Obuna tugagan boʻlsa ham ishlaydi: frontend avval "kimsan" deb soʻraydi,
  // keyin roliga qarab "obunani yangilang" ekranini koʻrsatadi
  @AllowExpired()
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}
