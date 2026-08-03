import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { PdfRendererService } from "../proposal-documents/pdf-renderer.service";
import { PayrollAuditLogService } from "./audit/payroll-audit-log.service";
import { PayrollConfigController } from "./config/payroll-config.controller";
import { PayrollConfigService } from "./config/payroll-config.service";
import { PayrollDocumentsController } from "./documents/payroll-documents.controller";
import { PayrollDocumentsService } from "./documents/payroll-documents.service";
import { PayrollListExcelService } from "./documents/payroll-list-excel.service";
import { PayslipDataService } from "./documents/payslip-data.service";
import { ComponentEvaluatorService } from "./engines/component-evaluator/component-evaluator.service";
import { DependencyEngineService } from "./engines/dependency-engine/dependency-engine.service";
import { FormulaEngineService } from "./engines/formula-engine/formula-engine.service";
import { InsuranceEngineService } from "./engines/insurance-engine/insurance-engine.service";
import { RuleEngineService } from "./engines/rule-engine/rule-engine.service";
import { TaxEngineService } from "./engines/tax-engine/tax-engine.service";
import { PayrollPeriodController } from "./period/payroll-period.controller";
import { PayrollPeriodService } from "./period/payroll-period.service";
import { PayrollProcessorService } from "./pipeline/payroll-processor.service";
import { LoadRulesStage } from "./pipeline/stages/01-load-rules.stage";
import { LoadEmployeeStage } from "./pipeline/stages/02-load-employee.stage";
import { LoadWorkLogStage } from "./pipeline/stages/03-load-worklog.stage";
import { EvaluateComponentsStage } from "./pipeline/stages/04-evaluate-components.stage";
import { CalculateEarningsStage } from "./pipeline/stages/05-calculate-earnings.stage";
import { CalculateInsuranceBaseStage } from "./pipeline/stages/06-calculate-insurance-base.stage";
import { InsuranceStage } from "./pipeline/stages/07-insurance.stage";
import { CalculateTaxableIncomeStage } from "./pipeline/stages/08-calculate-taxable-income.stage";
import { TaxStage } from "./pipeline/stages/09-tax.stage";
import { OtherDeductionsStage } from "./pipeline/stages/10-other-deductions.stage";
import { NetSalaryStage } from "./pipeline/stages/11-net-salary.stage";
import { EmployerCostStage } from "./pipeline/stages/12-employer-cost.stage";
import { StoreResultStage } from "./pipeline/stages/13-store-result.stage";
import { PayrollProfileController } from "./profile/payroll-profile.controller";
import { PayrollProfileService } from "./profile/payroll-profile.service";
import { EmployeePayrollProfileRepository } from "./repositories/employee-payroll-profile.repository";
import { FormulaRepository } from "./repositories/formula.repository";
import { PayrollComponentRepository } from "./repositories/payroll-component.repository";
import { PayrollPeriodRepository } from "./repositories/payroll-period.repository";
import { PayrollResultRepository } from "./repositories/payroll-result.repository";
import { PayrollRuleVersionRepository } from "./repositories/payroll-rule-version.repository";
import { PayrollYearRepository } from "./repositories/payroll-year.repository";
import { WorkLogAggregatorService } from "./worklog/worklog-aggregator.service";
import { PayrollWorkflowService } from "./workflow/payroll-workflow.service";

@Module({
  imports: [PermissionsModule, FilesModule],
  controllers: [
    PayrollConfigController,
    PayrollProfileController,
    PayrollPeriodController,
    PayrollDocumentsController,
  ],
  providers: [
    // Engines
    FormulaEngineService,
    DependencyEngineService,
    ComponentEvaluatorService,
    RuleEngineService,
    InsuranceEngineService,
    TaxEngineService,
    // Repositories
    PayrollYearRepository,
    PayrollRuleVersionRepository,
    FormulaRepository,
    PayrollComponentRepository,
    PayrollPeriodRepository,
    PayrollResultRepository,
    EmployeePayrollProfileRepository,
    // Pipeline
    LoadRulesStage,
    LoadEmployeeStage,
    LoadWorkLogStage,
    EvaluateComponentsStage,
    CalculateEarningsStage,
    CalculateInsuranceBaseStage,
    InsuranceStage,
    CalculateTaxableIncomeStage,
    TaxStage,
    OtherDeductionsStage,
    NetSalaryStage,
    EmployerCostStage,
    StoreResultStage,
    PayrollProcessorService,
    // WorkLog / Workflow / Audit
    WorkLogAggregatorService,
    PayrollWorkflowService,
    PayrollAuditLogService,
    // Application services
    PayrollConfigService,
    PayrollProfileService,
    PayrollPeriodService,
    // Document generation — از PdfRendererService پروژه‌ی proposal-documents استفاده مجدد می‌شود
    PdfRendererService,
    PayslipDataService,
    PayrollListExcelService,
    PayrollDocumentsService,
  ],
  exports: [PayrollProcessorService, WorkLogAggregatorService],
})
export class PayrollModule {}
