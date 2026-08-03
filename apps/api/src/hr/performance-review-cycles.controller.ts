import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { PerformanceReviewCyclesService } from "./performance-review-cycles.service";
import { CreatePerformanceReviewCycleDto } from "./dto/performance-review-cycle.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("performance-review-cycles")
export class PerformanceReviewCyclesController {
  constructor(private readonly service: PerformanceReviewCyclesService) {}

  // فهرست برای همه کاربران لاگین‌شده لازمه (فرم ساخت بررسی هم اینجا هم انتخاب دوره در پروفایل)
  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions("hr.manage")
  @Post()
  create(@Body() dto: CreatePerformanceReviewCycleDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Post(":id/close")
  close(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.close(id);
  }
}
