import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { MissionRequestsService } from "./mission-requests.service";
import { CreateMissionRequestDto } from "./dto/mission-request.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class MissionRequestsController {
  constructor(private readonly service: MissionRequestsService) {}

  @Post("mission-requests")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateMissionRequestDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("mission-requests/mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user.userId);
  }

  @Post("mission-requests/:id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(user.userId, id);
  }

  @Get("mission-requests/pending-approval")
  pendingApproval(@CurrentUser() user: RequestUser) {
    return this.service.pendingApproval(user.userId);
  }

  @Post("mission-requests/:id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.approve(user.userId, id);
  }

  @Post("mission-requests/:id/reject")
  reject(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.reject(user.userId, id);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/mission-requests")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }
}
