import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// @Roles('ADMIN', 'SUPER_ADMIN') ko'rinishida ishlatiladi
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
