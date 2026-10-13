import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../schemas/admin-user.schema';

export const ROLES_KEY = 'roles';

/**
 * Decorator to enforce required administrative roles on routes or controllers.
 * Checked by RolesGuard after authentication has been established.
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
