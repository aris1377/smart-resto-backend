import { IsInt, IsString, Length, Min } from 'class-validator';

export class LoginPinDto {
  // PIN login ikki bosqichli: xodim allaqachon roʻyxatdan tanlangan
  @IsInt({ message: 'Xodim tanlanmagan.' })
  @Min(1)
  userId: number;

  @IsString()
  @Length(4, 8, { message: 'PIN-kod 4-8 ta belgidan iborat boʻlishi kerak.' })
  pinCode: string;
}
