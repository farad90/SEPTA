import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ActionCenterService } from "./action-center.service";

// طبق SPEC-PHASE-31: بدون کلید RBAC اجباری برای مشاهدهٔ حالت شخصی («مرکز اقدامات من»
// برای هر کاربر لاگین‌شده معناداره)؛ حالت team فقط داخل سرویس مشروط به مجوز باز می‌شه
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions()
@Controller("action-center")
export class ActionCenterController {
  constructor(private readonly service: ActionCenterService) {}

  @Get()
  get(@Query("scope") scope: string | undefined, @CurrentUser() user: RequestUser) {
    return this.service.getForUser(user.userId, scope === "team" ? "team" : "mine");
  }
}
