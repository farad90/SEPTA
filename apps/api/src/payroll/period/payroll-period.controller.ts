import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../../permissions/permissions.guard";
import { RequirePermissions } from "../../permissions/require-permissions.decorator";
import { CreatePayrollPeriodDto, ManualWorkLogDto, TransitionResultDto } from "../dto/payroll-period.dto";
import { mapPayrollDomainError } from "../payroll-domain-error.mapper";
import { PayrollWorkflowService } from "../workflow/payroll-workflow.service";
import { PayrollPeriodService } from "./payroll-period.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payroll")
export class PayrollPeriodController {
  constructor(
    private readonly periodService: PayrollPeriodService,
    private readonly workflowService: PayrollWorkflowService,
  ) {}

  @RequirePermissions("payroll_engine.view")
  @Get("periods")
  listByYear(@Query("payrollYearId", ParseUUIDPipe) payrollYearId: string) {
    return this.periodService.listByYear(payrollYearId);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("periods/:id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.periodService.getById(id);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("periods")
  createPeriod(@Body() dto: CreatePayrollPeriodDto) {
    return this.periodService.createPeriod(dto);
  }

  @RequirePermissions("payroll_engine.manage_worklog")
  @Post("periods/:id/aggregate-worklog")
  aggregateWorkLog(@Param("id", ParseUUIDPipe) id: string) {
    return this.periodService.aggregateWorkLog(id);
  }

  @RequirePermissions("payroll_engine.manage_worklog")
  @Post("periods/:id/worklog/:employeeId")
  setManualWorkLog(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
    @Body() dto: ManualWorkLogDto,
  ) {
    return this.periodService.setManualWorkLog(id, employeeId, dto);
  }

  @RequirePermissions("payroll_engine.run_calculation")
  @Post("periods/:id/calculate")
  calculateForPeriod(@Param("id", ParseUUIDPipe) id: string) {
    return this.periodService.calculateForPeriod(id);
  }

  @RequirePermissions("payroll_engine.run_calculation")
  @Post("periods/:id/calculate/:employeeId")
  calculateForEmployee(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("employeeId", ParseUUIDPipe) employeeId: string,
  ) {
    return this.periodService.calculateForEmployee(id, employeeId);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("periods/:id/results")
  listResults(@Param("id", ParseUUIDPipe) id: string) {
    return this.periodService.listResults(id);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("results/:id")
  getResult(@Param("id", ParseUUIDPipe) id: string) {
    return this.periodService.getResult(id);
  }

  // پرمیژن دقیق بر مبنای targetStatus داخل PayrollWorkflowService چک می‌شود (نگاه کنید به آنجا)
  // چون هر مقصد (بازبینی/تأیید/ثبت/قفل) پرمیژن جدای خودش را دارد.
  @RequirePermissions("payroll_engine.view")
  @Post("results/:id/transition")
  transition(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransitionResultDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.transition(id, dto.targetStatus, user.userId).catch(mapPayrollDomainError);
  }
}
