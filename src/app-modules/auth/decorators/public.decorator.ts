import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a resolver as exempt from the global JwtAuthGuard (see guards/jwt-auth.guard.ts). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
