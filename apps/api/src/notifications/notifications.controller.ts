import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { NotificationsService } from "./notifications.service";

// طبق الگوی users/colleagues: اعلان‌ها دادهٔ شخصی کاربرن، نه سازمانی —
// همهٔ endpoint ها برای هر کاربر لاگین‌شده باز می‌مونن، بدون کلید دسترسی جدید.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.notificationsService.list(user.userId);
  }

  @Post(":id/read")
  markRead(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Post("mark-all-read")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Post(":id/action")
  action(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.recordAction(id, user.userId);
  }
}
