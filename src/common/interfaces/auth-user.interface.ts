import { Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  tenantId: number | null;
  branchId: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
}
