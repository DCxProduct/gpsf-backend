import { Role } from '@/modules/auth/enums/role.enum';

// Seed credentials come from env so production can change them without editing code.
const systemSuperAdminUsername = process.env.SYSTEM_SUPER_ADMIN_USERNAME?.trim() || 'superadmin';
const systemSuperAdminEmail = process.env.SYSTEM_SUPER_ADMIN_EMAIL?.trim() || 'superadmin@gmail.com';
const systemSuperAdminPassword = process.env.SYSTEM_SUPER_ADMIN_PASSWORD?.trim() || '12345678';

export const SYSTEM_SUPER_ADMIN = {
  username: systemSuperAdminUsername,
  email: systemSuperAdminEmail,
  password: systemSuperAdminPassword,
  role: Role.SuperAdmin,
} as const;
