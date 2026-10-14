import { IsBoolean } from 'class-validator';

export class SetStopListDto {
  /** false — taom tugadi (stop-list), true — yana bor */
  @IsBoolean()
  isAvailable: boolean;
}
