import { Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  branchId: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
}
