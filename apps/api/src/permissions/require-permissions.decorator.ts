import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** روی هر Controller method: نیازمند تمام permission_keyهای داده‌شده */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
