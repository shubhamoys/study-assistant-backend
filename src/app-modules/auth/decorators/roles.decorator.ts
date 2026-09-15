import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../database/enums';

export const ROLES_KEY = 'roles';

/** Restricts a resolver/route to the given role(s) — see guards/roles.guard.ts. Requires JwtAuthGuard to have already run (unauthenticated requests never reach here unless also @Public(), which would defeat the point). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
