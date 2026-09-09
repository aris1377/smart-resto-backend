import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 32;

@Injectable()
export class HashService {
  /** Parol va PIN uchun — sekin, tuzli */
  hashSecret(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  compareSecret(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** Refresh token uchun — 256 bitli tasodifiy satr */
  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  /** Refresh token uchun — tez, tuzsiz, qidirsa bo'ladigan */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
