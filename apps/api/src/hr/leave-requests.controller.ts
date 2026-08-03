import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { LeaveRequestsService } from "./leave-requests.service";
import { CreateLeaveRequestDto } from "./dto/leave-request.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class LeaveRequestsController {
  constructor(private readonly service: LeaveRequestsService) {}

  @Post("leave-requests")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLeaveRequestDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("leave-requests/mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user.userId);
  }

  @Post("leave-requests/:id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(user.userId, id);
  }

  @Get("leave-requests/pending-approval")
  pendingApproval(@CurrentUser() user: RequestUser) {
    return this.service.pendingApproval(user.userId);
  }

  @Post("leave-requests/:id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.approve(user.userId, id);
  }

  @Post("leave-requests/:id/reject")
  reject(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.reject(user.userId, id);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/leave-requests")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }
}
