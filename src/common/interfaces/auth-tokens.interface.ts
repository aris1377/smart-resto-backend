import { AuthUser } from '../../common/interfaces';

/** Login/refresh natijasi — service va controller orasidagi shartnoma */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
