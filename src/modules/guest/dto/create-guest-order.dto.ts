import { IsUUID } from 'class-validator';
import { AddOrderItemsDto } from './add-order-items.dto';

export class CreateGuestOrderDto extends AddOrderItemsDto {
  /** Stoldagi QR ichidagi token — qaysi restoran, filial va stol ekanini bildiradi */
  @IsUUID(4)
  tableToken: string;
}
