import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DependencyEngineService } from "../engines/dependency-engine/dependency-engine.service";
import { FormulaEngineService } from "../engines/formula-engine/formula-engine.service";
import { RuleEngineService } from "../engines/rule-engine/rule-engine.service";
import { FormulaRepository } from "../repositories/formula.repository";
import { PayrollComponentRepository } from "../repositories/payroll-component.repository";
import { PayrollRuleVersionRepository } from "../repositories/payroll-rule-version.repository";
import { PayrollYearRepository } from "../repositories/payroll-year.repository";
import {
  CreateComponentDto,
  CreatePayrollYearDto,
  CreateRuleVersionDto,
  ReplaceBracketsDto,
  UpdateComponentDto,
  UpsertFormulaDto,
  UpsertRuleDto,
} from "../dto/payroll-config.dto";

/**
 * لایه‌ی Controller→Service→Repository برای بخش «تنظیمات» موتور حقوق (سال/نسخه‌ی قانون/
 * قانون/پله‌ی مالیات/فرمول/جزء). هیچ محاسبه‌ای اینجا انجام نمی‌شه — فقط CRUD + نامعتبرسازی
 * کش Engine‌ها بعد از هر تغییر (چون Rule/Formula/Dependency Engine همگی در حافظه کش می‌کنن).
 */
@Injectable()
export class PayrollConfigService {
  constructor(
    private readonly yearRepository: PayrollYearRepository,
    private readonly ruleVersionRepository: PayrollRuleVersionRepository,
    private readonly formulaRepository: FormulaRepository,
    private readonly componentRepository: PayrollComponentRepository,
    private readonly ruleEngine: RuleEngineService,
    private readonly formulaEngine: FormulaEngineService,
    private readonly dependencyEngine: DependencyEngineService,
  ) {}

  private invalidateCalculationCaches(ruleVersionId?: string): void {
    if (ruleVersionId) this.ruleEngine.invalidate(ruleVersionId);
    this.formulaEngine.invalidateAll();
    this.dependencyEngine.invalidateAll();
  }

  // ------------------------------------------------------------ سال حقوقی
  listYears() {
    return this.yearRepository.list();
  }

  async createYear(dto: CreatePayrollYearDto) {
    const existing = await this.yearRepository.findByYearNumber(dto.yearNumber);
    if (existing) throw new BadRequestException("این سال قبلاً ثبت شده");
    return this.yearRepository.create(dto);
  }

  // ------------------------------------------------------------ نسخه‌ی قانون
  listRuleVersions(payrollYearId: string) {
    return this.ruleVersionRepository.listByYear(payrollYearId);
  }

  async getRuleVersion(id: string) {
    const version = await this.ruleVersionRepository.findById(id);
    if (!version) throw new NotFoundException("نسخه‌ی قانون یافت نشد");
    return version;
  }

  createRuleVersion(dto: CreateRuleVersionDto) {
    return this.ruleVersionRepository.create({
      payrollYearId: dto.payrollYearId,
      versionNumber: dto.versionNumber,
      title: dto.title,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
    });
  }

  async updateRuleVersionStatus(id: string, status: string) {
    const updated = await this.ruleVersionRepository.updateStatus(id, status);
    this.invalidateCalculationCaches(id);
    return updated;
  }

  async upsertRule(ruleVersionId: string, dto: UpsertRuleDto) {
    const rule = await this.ruleVersionRepository.upsertRule(ruleVersionId, dto.code, {
      title: dto.title,
      valueType: dto.valueType,
      value: dto.value,
      effectiveDate: new Date(dto.effectiveDate),
      expireDate: dto.expireDate ? new Date(dto.expireDate) : null,
      description: dto.description ?? null,
    });
    this.invalidateCalculationCaches(ruleVersionId);
    return rule;
  }

  async replaceBrackets(ruleVersionId: string, dto: ReplaceBracketsDto) {
    await this.ruleVersionRepository.replaceBrackets(ruleVersionId, dto.brackets);
    this.invalidateCalculationCaches(ruleVersionId);
  }

  // ------------------------------------------------------------ فرمول
  listFormulas(ruleVersionId: string) {
    return this.formulaRepository.listByRuleVersion(ruleVersionId);
  }

  async upsertFormula(ruleVersionId: string, dto: UpsertFormulaDto) {
    const formula = await this.formulaRepository.upsert(ruleVersionId, dto.code, {
      expression: dto.expression,
      description: dto.description ?? null,
    });
    this.invalidateCalculationCaches(ruleVersionId);
    return formula;
  }

  /** پیش‌نمایش صرفاً‌نحوی یک عبارت، بدون ذخیره — برای فرم ادمین قبل از ثبت. */
  previewFormula(expression: string) {
    this.formulaEngine.parseUncached(expression);
    return { valid: true };
  }

  // ------------------------------------------------------------ جزء حقوق
  listComponents() {
    return this.componentRepository.listActive();
  }

  async createComponent(dto: CreateComponentDto) {
    const component = await this.componentRepository.create(dto);
    this.invalidateCalculationCaches();
    return component;
  }

  async updateComponent(id: string, dto: UpdateComponentDto) {
    const existing = await this.componentRepository.findById(id);
    if (!existing) throw new NotFoundException("جزء حقوق یافت نشد");
    const updated = await this.componentRepository.update(id, dto);
    this.invalidateCalculationCaches();
    return updated;
  }
}
