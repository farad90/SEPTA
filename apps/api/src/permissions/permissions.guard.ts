import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsService } from "./permissions.service";
import { PERMISSIONS_KEY } from "./require-permissions.decorator";

/**
 * باید بعد از JwtAuthGuard اجرا بشه (یعنی @UseGuards(JwtAuthGuard, PermissionsGuard))
 * چون به request.user.userId که JwtAuthGuard ست می‌کنه نیاز داره.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    if (!userId) {
      throw new ForbiddenException("احراز هویت لازمه");
    }

    const effective = await this.permissionsService.getEffectivePermissions(userId);
    const effectiveKeys = new Set(effective.map((permission) => permission.permissionKey));
    const hasAll = required.every((key) => effectiveKeys.has(key));

    if (!hasAll) {
      throw new ForbiddenException("دسترسی کافی برای این عملیات ندارید");
    }

    return true;
  }
}
