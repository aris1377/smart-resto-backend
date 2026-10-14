import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * OWNER tokenida branchId yo'q — u qaysi filial haqida so'rayotganini
 * shu parametr bilan aytadi. Xodimda esa e'tiborsiz qoldiriladi.
 */
export class BranchScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;
}
