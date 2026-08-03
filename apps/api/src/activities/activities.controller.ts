import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ActivitiesService } from "./activities.service";
import {
  CompleteActivityDto,
  CreateActivityDto,
  ListActivitiesQueryDto,
  UpdateActivityDto,
} from "./dto/activity.dto";
import { AddCommentDto, AddWatcherDto, ReassignTaskDto, RecordOutcomeDto } from "./dto/task-collaboration.dto";

// طبق SPEC-PHASE-16: بدون کلید RBAC جدید — قواعد دسترسی داخل ActivitiesService
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions()
@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  list(@Query() query: ListActivitiesQueryDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.list(user.userId, query);
  }

  @Post()
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.create(dto, user.userId);
  }

  @Get(":id")
  getOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.activitiesService.getOne(id, user.userId);
  }

  @Get(":id/timeline")
  getTimeline(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.activitiesService.getTimeline(id, user.userId);
  }

  @Post(":id/comments")
  addComment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.addComment(id, dto, user.userId);
  }

  @Post(":id/reassign")
  reassign(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReassignTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.reassign(id, dto, user.userId);
  }

  @Post(":id/watchers")
  addWatcher(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddWatcherDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.addWatcher(id, dto, user.userId);
  }

  @Delete(":id/watchers/:userId")
  removeWatcher(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.removeWatcher(id, userId, user.userId);
  }

  @Post(":id/record-outcome")
  recordOutcome(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordOutcomeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.recordOutcome(id, dto, user.userId);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.update(id, dto, user.userId);
  }

  @Post(":id/complete")
  complete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CompleteActivityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.complete(id, dto, user.userId);
  }

  @Post(":id/cancel")
  cancel(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.activitiesService.cancel(id, user.userId);
  }
}
