import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { PayrollPeriodsService } from "./payroll-periods.service";
import { PayslipsService } from "./payslips.service";
import { CreatePayrollPeriodDto } from "./dto/payroll-period.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payroll-periods")
export class PayrollPeriodsController {
  constructor(
    private readonly service: PayrollPeriodsService,
    private readonly payslips: PayslipsService,
  ) {}

  @RequirePermissions("hr.view")
  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions("hr.manage")
  @Post()
  create(@Body() dto: CreatePayrollPeriodDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Post(":id/finalize")
  finalize(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.finalize(id);
  }

  @RequirePermissions("hr.manage")
  @Post(":id/mark-paid")
  markPaid(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.markPaid(id);
  }

  @RequirePermissions("hr.view")
  @Get(":id/payslips")
  listPayslips(@Param("id", ParseUUIDPipe) id: string) {
    return this.payslips.listForPeriod(id);
  }

  @RequirePermissions("hr.manage")
  @Post(":id/payslips/:employeeId/generate")
  generate(@Param("id", ParseUUIDPipe) id: string, @Param("employeeId", ParseUUIDPipe) employeeId: string) {
    return this.payslips.generate(id, employeeId);
  }
}
