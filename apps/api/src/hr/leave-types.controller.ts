import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { LeaveTypesService } from "./leave-types.service";
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from "./dto/leave-type.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("leave-types")
export class LeaveTypesController {
  constructor(private readonly service: LeaveTypesService) {}

  // فهرست برای همه کاربران لاگین‌شده لازمه — هم فرم خودسرویس مرخصی، هم مدیریت HR
  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions("hr.manage")
  @Post()
  create(@Body() dto: CreateLeaveTypeDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.service.update(id, dto);
  }
}
