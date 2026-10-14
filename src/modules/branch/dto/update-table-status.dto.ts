import { TableStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTableStatusDto {
  @IsEnum(TableStatus, {
    message:
      'Status FREE, OCCUPIED, RESERVED yoki BILL_REQUESTED boʻlishi kerak.',
  })
  status: TableStatus;
}
