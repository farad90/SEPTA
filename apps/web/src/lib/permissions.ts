import { AuthUser } from "./auth-context";

export function hasPermission(user: AuthUser | null, key: string): boolean {
  return !!user?.permissions.some((permission) => permission.permissionKey === key);
}

/** true اگر کاربر حداقل یکی از کلیدها رو داشته باشه */
export function hasAnyPermission(user: AuthUser | null, keys: string | string[]): boolean {
  const list = Array.isArray(keys) ? keys : [keys];
  return list.some((key) => hasPermission(user, key));
}
