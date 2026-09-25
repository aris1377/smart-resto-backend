import { IsBoolean } from 'class-validator';

export class UpdateTenantStatusDto {
  /** false — shartnoma bekor qilindi, restoran butunlay bloklanadi */
  @IsBoolean()
  isActive: boolean;
}
