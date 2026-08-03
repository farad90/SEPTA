import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../permissions/permissions.guard";
import { RequirePermissions } from "../../permissions/require-permissions.decorator";
import { UpsertPayrollProfileDto } from "../dto/payroll-profile.dto";
import { PayrollProfileService } from "./payroll-profile.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payroll/profiles")
export class PayrollProfileController {
  constructor(private readonly service: PayrollProfileService) {}

  @RequirePermissions("payroll_engine.view")
  @Get(":employeeId")
  getByEmployeeId(@Param("employeeId", ParseUUIDPipe) employeeId: string) {
    return this.service.getByEmployeeId(employeeId);
  }

  @RequirePermissions("payroll_engine.manage_profile")
  @Put(":employeeId")
  upsert(@Param("employeeId", ParseUUIDPipe) employeeId: string, @Body() dto: UpsertPayrollProfileDto) {
    return this.service.upsert(employeeId, dto);
  }
}
