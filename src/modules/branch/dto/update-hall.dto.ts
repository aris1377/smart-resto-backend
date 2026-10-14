import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateHallDto } from './create-hall.dto';

// branchId yo'q: zalni boshqa filialga ko'chirib bo'lmaydi — ichidagi
// stollar va ularning QR kodlari eski filialga bog'langan
export class UpdateHallDto extends PartialType(
  OmitType(CreateHallDto, ['branchId'] as const),
) {}
