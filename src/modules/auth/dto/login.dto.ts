import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  // Bazada email kichik harflarda saqlanadi — kirishda ham shunga keltiramiz
  @Transform(({ value }): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email formati notoʻgʻri.' })
  email: string;

  @IsString()
  @MinLength(6, {
    message: 'Parol kamida 6 ta belgidan iborat boʻlishi kerak.',
  })
  @MaxLength(72)
  password: string;
}
