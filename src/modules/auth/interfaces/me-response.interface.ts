import { AuthUser } from '../../../common/interfaces';

/** `GET /auth/me` javobi — tokendagi foydalanuvchi + u ishlaydigan joy */
export interface MeResponse extends AuthUser {
  /** SUPER_ADMIN hech qaysi restoranga bogʻlanmagan — unda `null` */
  tenant: {
    id: number;
    name: string;
    city: string | null;
    logoUrl: string | null;
    /** `false` — restoran bloklangan, "platforma bilan bogʻlaning" ekrani */
    isActive: boolean;
  } | null;

  /** OWNER va SUPER_ADMIN bitta filialga biriktirilmagan — ularda `null` */
  branch: {
    id: number;
    name: string;
    address: string | null;
  } | null;
}
