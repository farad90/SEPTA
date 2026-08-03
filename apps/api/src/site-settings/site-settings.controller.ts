import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { SiteSettingsService } from "./site-settings.service";
import { UpdateLoginBackgroundDto } from "./dto/update-login-background.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("site_settings.manage")
@Controller("site-settings")
export class SiteSettingsController {
  constructor(private readonly service: SiteSettingsService) {}

  @Get()
  getSettings() {
    return this.service.getSettings();
  }

  @Put("login-background")
  updateLoginBackground(@Body() dto: UpdateLoginBackgroundDto, @CurrentUser() user: RequestUser) {
    return this.service.updateLoginBackground(dto, user.userId);
  }
}
