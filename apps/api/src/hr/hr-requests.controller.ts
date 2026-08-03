import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { HrRequestsService } from "./hr-requests.service";
import { CreateHrRequestDto } from "./dto/hr-request.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class HrRequestsController {
  constructor(private readonly service: HrRequestsService) {}

  @Post("hr-requests")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateHrRequestDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("hr-requests/mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user.userId);
  }

  @Post("hr-requests/:id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(user.userId, id);
  }

  @Get("hr-requests/pending-approval")
  pendingApproval(@CurrentUser() user: RequestUser) {
    return this.service.pendingApproval(user.userId);
  }

  @Post("hr-requests/:id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.approve(user.userId, id);
  }

  @Post("hr-requests/:id/reject")
  reject(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.reject(user.userId, id);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/hr-requests")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }
}
