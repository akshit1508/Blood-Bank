import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../schemas/admin-user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Bypass role check on deliberately public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Extract required roles from handler or controller metadata
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 3. Verify authenticated administrator presence
    const request = context.switchToHttp().getRequest();
    const admin = request.admin || request.user;

    if (!admin || !admin.role) {
      throw new UnauthorizedException('Authentication is required prior to role verification.');
    }

    // 4. Genuinely fail-closed: if protected endpoint has no role metadata, deny access
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Access denied: Protected endpoint has no declared role metadata (fail-closed security policy).',
      );
    }

    // 5. Verify role membership
    const hasRole = requiredRoles.includes(admin.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Forbidden resource: Required role(s) [${requiredRoles.join(', ')}], current role is '${admin.role}'.`,
      );
    }

    return true;
  }
}
