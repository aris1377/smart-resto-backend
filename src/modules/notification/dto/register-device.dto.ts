import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DEVICE_TOKEN_MAX_LENGTH } from '../notification.constants';

export class RegisterDeviceDto {
  /** FCM registratsiya tokeni — uni mobil ilova Firebase SDK'dan oladi */
  @IsString()
  @IsNotEmpty()
  @MaxLength(DEVICE_TOKEN_MAX_LENGTH)
  token: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
