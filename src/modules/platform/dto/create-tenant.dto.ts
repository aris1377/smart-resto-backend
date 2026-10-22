import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateTenantOwnerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  @IsEmail({}, { message: 'Email formati notoʻgʻri.' })
  email: string;

  // Platforma yaratadigan hisob — logindagi 6 ta emas, kamida 8 ta belgi
  @IsString()
  @MinLength(8, {
    message: 'Parol kamida 8 ta belgidan iborat boʻlishi kerak.',
  })
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Platforma ro'yxatida nom ostida ko'rinadi ("ID 1 · Toshkent") */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  // @ValidateNested oʻzi undefined qiymatni oʻtkazib yuboradi —
  // @IsNotEmptyObject boʻlmasa, owner yuborilmaganda service 500 beradi
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateTenantOwnerDto)
  owner: CreateTenantOwnerDto;

  // Filial bu yerda ochilmaydi — uni egasining oʻzi `POST /branches` orqali
  // yaratadi (Faza 4). Aks holda obuna va maxBranches tekshiruvlari
  // chetlab oʻtiladi va qoida ikki joyda yozilishi kerak boʻlardi.
}
