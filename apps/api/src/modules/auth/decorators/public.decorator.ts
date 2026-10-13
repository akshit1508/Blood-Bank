import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to explicitly mark route handlers or entire controllers as publicly accessible.
 * Bypasses global AdminAuthGuard and RolesGuard checks.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
