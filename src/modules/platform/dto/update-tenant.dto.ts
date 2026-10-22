import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Restoran kartochkasini tahrirlash.
 *
 * Bu yerda faqat platforma yurituvchi maydonlar bor. Obuna `POST
 * /tenants/:id/subscription`, bloklash esa `PATCH /tenants/:id/status`
 * orqali o'zgaradi — har biri o'z qoidasiga ega bo'lgani uchun aralashmaydi.
 */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}
