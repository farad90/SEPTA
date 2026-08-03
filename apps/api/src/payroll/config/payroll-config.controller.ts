import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../permissions/permissions.guard";
import { RequirePermissions } from "../../permissions/require-permissions.decorator";
import { PayrollConfigService } from "./payroll-config.service";
import {
  CreateComponentDto,
  CreatePayrollYearDto,
  CreateRuleVersionDto,
  ReplaceBracketsDto,
  UpdateComponentDto,
  UpdateRuleVersionStatusDto,
  UpsertFormulaDto,
  UpsertRuleDto,
} from "../dto/payroll-config.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payroll")
export class PayrollConfigController {
  constructor(private readonly service: PayrollConfigService) {}

  @RequirePermissions("payroll_engine.view")
  @Get("years")
  listYears() {
    return this.service.listYears();
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("years")
  createYear(@Body() dto: CreatePayrollYearDto) {
    return this.service.createYear(dto);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("rule-versions")
  listRuleVersions(@Query("payrollYearId", ParseUUIDPipe) payrollYearId: string) {
    return this.service.listRuleVersions(payrollYearId);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("rule-versions/:id")
  getRuleVersion(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getRuleVersion(id);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("rule-versions")
  createRuleVersion(@Body() dto: CreateRuleVersionDto) {
    return this.service.createRuleVersion(dto);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Patch("rule-versions/:id/status")
  updateRuleVersionStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateRuleVersionStatusDto) {
    return this.service.updateRuleVersionStatus(id, dto.status);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("rule-versions/:id/rules")
  upsertRule(@Param("id", ParseUUIDPipe) ruleVersionId: string, @Body() dto: UpsertRuleDto) {
    return this.service.upsertRule(ruleVersionId, dto);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("rule-versions/:id/brackets")
  replaceBrackets(@Param("id", ParseUUIDPipe) ruleVersionId: string, @Body() dto: ReplaceBracketsDto) {
    return this.service.replaceBrackets(ruleVersionId, dto);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("rule-versions/:id/formulas")
  listFormulas(@Param("id", ParseUUIDPipe) ruleVersionId: string) {
    return this.service.listFormulas(ruleVersionId);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("rule-versions/:id/formulas")
  upsertFormula(@Param("id", ParseUUIDPipe) ruleVersionId: string, @Body() dto: UpsertFormulaDto) {
    return this.service.upsertFormula(ruleVersionId, dto);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("formulas/preview")
  previewFormula(@Body("expression") expression: string) {
    return this.service.previewFormula(expression);
  }

  @RequirePermissions("payroll_engine.view")
  @Get("components")
  listComponents() {
    return this.service.listComponents();
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Post("components")
  createComponent(@Body() dto: CreateComponentDto) {
    return this.service.createComponent(dto);
  }

  @RequirePermissions("payroll_engine.manage_config")
  @Patch("components/:id")
  updateComponent(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateComponentDto) {
    return this.service.updateComponent(id, dto);
  }
}
