import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PerformanceReviewsService } from "./performance-reviews.service";
import {
  CreatePerformanceReviewDto,
  SelfReviewDto,
  SubmitReviewDto,
  UpdatePerformanceReviewDto,
} from "./dto/performance-review.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PerformanceReviewsController {
  constructor(private readonly service: PerformanceReviewsService) {}

  @RequirePermissions("hr.manage")
  @Post("performance-reviews")
  create(@Body() dto: CreatePerformanceReviewDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/performance-reviews")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }

  @Get("performance-reviews/mine-as-employee")
  mineAsEmployee(@CurrentUser() user: RequestUser) {
    return this.service.mineAsEmployee(user.userId);
  }

  @Get("performance-reviews/mine-as-reviewer")
  mineAsReviewer(@CurrentUser() user: RequestUser) {
    return this.service.mineAsReviewer(user.userId);
  }

  @Patch("performance-reviews/:id/self-review")
  selfReview(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SelfReviewDto) {
    return this.service.selfReview(user.userId, id, dto);
  }

  @Patch("performance-reviews/:id/submit")
  submit(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SubmitReviewDto) {
    return this.service.submit(user.userId, id, dto);
  }

  @Post("performance-reviews/:id/acknowledge")
  acknowledge(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.acknowledge(user.userId, id);
  }

  @RequirePermissions("hr.manage")
  @Patch("performance-reviews/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceReviewDto) {
    return this.service.update(id, dto);
  }
}
