import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { OutcomeTemplatesService } from "./outcome-templates.service";
import { CreateOutcomeTemplateDto, UpdateOutcomeTemplateDto } from "./dto/outcome-template.dto";

// طبق SPEC-PHASE-17: بدون کلید RBAC جدید — لیست برای همه باز، نوشتن فقط اعضای گروه مدیریت (داخل سرویس چک می‌شه)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions()
@Controller("activity-outcome-templates")
export class OutcomeTemplatesController {
  constructor(private readonly outcomeTemplatesService: OutcomeTemplatesService) {}

  @Get()
  list(@Query("activityType") activityType?: string) {
    return this.outcomeTemplatesService.list(activityType);
  }

  @Post()
  create(@Body() dto: CreateOutcomeTemplateDto, @CurrentUser() user: RequestUser) {
    return this.outcomeTemplatesService.create(dto, user.userId);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOutcomeTemplateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.outcomeTemplatesService.update(id, dto, user.userId);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.outcomeTemplatesService.remove(id, user.userId);
  }
}
