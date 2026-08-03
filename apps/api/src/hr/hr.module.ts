import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";
import { EmployeeChildrenController } from "./employee-children.controller";
import { EmployeeChildrenService } from "./employee-children.service";
import { HrAccessService } from "./hr-access.service";
import { MeEmployeeController } from "./me-employee.controller";
import { LeaveTypesController } from "./leave-types.controller";
import { LeaveTypesService } from "./leave-types.service";
import { LeaveBalancesController } from "./leave-balances.controller";
import { LeaveBalancesService } from "./leave-balances.service";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { LeaveRequestsController } from "./leave-requests.controller";
import { LeaveRequestsService } from "./leave-requests.service";
import { MissionRequestsController } from "./mission-requests.controller";
import { MissionRequestsService } from "./mission-requests.service";
import { OvertimeRecordsController } from "./overtime-records.controller";
import { OvertimeRecordsService } from "./overtime-records.service";
import { EmployeeLoansController } from "./employee-loans.controller";
import { EmployeeLoansService } from "./employee-loans.service";
import { BenefitTypesController } from "./benefit-types.controller";
import { BenefitTypesService } from "./benefit-types.service";
import { DeductionTypesController } from "./deduction-types.controller";
import { DeductionTypesService } from "./deduction-types.service";
import { EmployeeBenefitsController } from "./employee-benefits.controller";
import { EmployeeBenefitsService } from "./employee-benefits.service";
import { EmployeeDeductionsController } from "./employee-deductions.controller";
import { EmployeeDeductionsService } from "./employee-deductions.service";
import { HrRequestsController } from "./hr-requests.controller";
import { HrRequestsService } from "./hr-requests.service";
import { PayrollPeriodsController } from "./payroll-periods.controller";
import { PayrollPeriodsService } from "./payroll-periods.service";
import { PayslipsController } from "./payslips.controller";
import { PayslipsService } from "./payslips.service";
import { PerformanceReviewCyclesController } from "./performance-review-cycles.controller";
import { PerformanceReviewCyclesService } from "./performance-review-cycles.service";
import { PerformanceReviewsController } from "./performance-reviews.controller";
import { PerformanceReviewsService } from "./performance-reviews.service";

@Module({
  imports: [PermissionsModule],
  controllers: [
    DepartmentsController,
    EmployeesController,
    EmployeeChildrenController,
    MeEmployeeController,
    LeaveTypesController,
    LeaveBalancesController,
    AttendanceController,
    LeaveRequestsController,
    MissionRequestsController,
    OvertimeRecordsController,
    EmployeeLoansController,
    BenefitTypesController,
    DeductionTypesController,
    EmployeeBenefitsController,
    EmployeeDeductionsController,
    HrRequestsController,
    PayrollPeriodsController,
    PayslipsController,
    PerformanceReviewCyclesController,
    PerformanceReviewsController,
  ],
  providers: [
    DepartmentsService,
    EmployeesService,
    EmployeeChildrenService,
    HrAccessService,
    LeaveTypesService,
    LeaveBalancesService,
    AttendanceService,
    LeaveRequestsService,
    MissionRequestsService,
    OvertimeRecordsService,
    EmployeeLoansService,
    BenefitTypesService,
    DeductionTypesService,
    EmployeeBenefitsService,
    EmployeeDeductionsService,
    HrRequestsService,
    PayrollPeriodsService,
    PayslipsService,
    PerformanceReviewCyclesService,
    PerformanceReviewsService,
  ],
  // فاز ۳۱ — لازم برای ActionCenterModule (تجمیع‌گر Read-Only تأییدهای پراکندهٔ HR)
  exports: [
    HrAccessService,
    LeaveRequestsService,
    MissionRequestsService,
    OvertimeRecordsService,
    EmployeeLoansService,
    HrRequestsService,
  ],
})
export class HrModule {}
