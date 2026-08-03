import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { AttendanceService } from "./attendance.service";
import { ListAttendanceQueryDto, UpsertAttendanceDto } from "./dto/attendance.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("employees/:id/attendance")
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @RequirePermissions("hr.view")
  @Get()
  list(@Param("id", ParseUUIDPipe) id: string, @Query() query: ListAttendanceQueryDto) {
    return this.service.listForEmployee(
      id,
      query.month ? Number(query.month) : undefined,
      query.year ? Number(query.year) : undefined,
    );
  }

  @RequirePermissions("hr.manage")
  @Post()
  upsert(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpsertAttendanceDto) {
    return this.service.upsertManual(id, dto);
  }
}
