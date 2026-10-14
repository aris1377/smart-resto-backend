import { PartialType } from '@nestjs/swagger';
import { CreateBranchDto } from './create-branch.dto';

// Filialni boshqa restoranga ko'chirish mumkin emas — `tenantId` tokendan
// olinadi va hech qachon so'rovdan o'qilmaydi
export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
