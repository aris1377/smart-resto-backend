import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_ITEM_QUANTITY } from '../guest.constants';

export class OrderItemInputDto {
  @IsInt()
  @Min(1)
  productId: number;

  /**
   * Portsiya soni — butun son. Tortiladigan taomning aniq vazni
   * (masalan 1.35 kg) ofitsiant tomonidan Faza 7 da to'g'rilanadi.
   */
  @IsInt()
  @Min(1)
  @Max(MAX_ITEM_QUANTITY)
  quantity: number;

  /** "Piyozsiz", "achchiqroq" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;

  // Narx ataylab yo'q: u har doim bazadan olinadi
}
