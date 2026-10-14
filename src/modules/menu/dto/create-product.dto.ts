import { Unit } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  /** Mahsulot filialga emas, kategoriyaga bog'lanadi; filial shundan chiqadi */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId: number;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Pul — matn, Decimal bo'lib saqlanadi (yaxlitlash xatosi bo'lmasin) */
  @IsDecimal(
    { decimal_digits: '0,2' },
    {
      message:
        'Narx matn koʻrinishida boʻlsin, masalan "25000" yoki "25000.50".',
    },
  )
  price: string;

  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  /** O'lchov hajmi: 0.5 kg, 200 gramm va h.k. */
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  unitValue?: string;
}
