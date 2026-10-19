import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { MAX_ITEMS_PER_REQUEST } from '../guest.constants';
import { OrderItemInputDto } from './order-item-input.dto';

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Kamida bitta taom tanlang.' })
  @ArrayMaxSize(MAX_ITEMS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
}
