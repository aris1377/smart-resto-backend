import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DEVICE_TOKEN_MAX_LENGTH } from '../notification.constants';

export class UnregisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(DEVICE_TOKEN_MAX_LENGTH)
  token: string;
}
