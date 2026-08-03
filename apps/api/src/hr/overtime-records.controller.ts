import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { OvertimeRecordsService } from "./overtime-records.service";
import { CreateOvertimeRecordDto } from "./dto/overtime-record.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OvertimeRecordsController {
  constructor(private readonly service: OvertimeRecordsService) {}

  @Post("overtime-records")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOvertimeRecordDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("overtime-records/mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user.userId);
  }

  @Post("overtime-records/:id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(user.userId, id);
  }

  @Get("overtime-records/pending-approval")
  pendingApproval(@CurrentUser() user: RequestUser) {
    return this.service.pendingApproval(user.userId);
  }

  @Post("overtime-records/:id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.approve(user.userId, id);
  }

  @Post("overtime-records/:id/reject")
  reject(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.reject(user.userId, id);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/overtime-records")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }
}
