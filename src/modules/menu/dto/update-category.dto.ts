import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

// branchId yo'q: kategoriyani boshqa filialga ko'chirib bo'lmaydi —
// uning ichidagi mahsulotlar va order tarixi eski filialga bog'langan
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['branchId'] as const),
) {}
