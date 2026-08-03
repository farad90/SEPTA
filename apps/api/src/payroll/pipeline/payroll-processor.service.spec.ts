import { ComponentEvaluatorService } from "../engines/component-evaluator/component-evaluator.service";
import { DependencyEngineService } from "../engines/dependency-engine/dependency-engine.service";
import { FormulaEngineService } from "../engines/formula-engine/formula-engine.service";
import { InsuranceEngineService } from "../engines/insurance-engine/insurance-engine.service";
import { RuleEngineService } from "../engines/rule-engine/rule-engine.service";
import { TaxEngineService } from "../engines/tax-engine/tax-engine.service";
import { PayrollComponentRepository } from "../repositories/payroll-component.repository";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { EmployeeContractNotFoundError } from "./errors";
import { PayrollProcessorService } from "./payroll-processor.service";
import { CalculateEarningsStage } from "./stages/05-calculate-earnings.stage";
import { CalculateInsuranceBaseStage } from "./stages/06-calculate-insurance-base.stage";
import { CalculateTaxableIncomeStage } from "./stages/08-calculate-taxable-income.stage";
import { EvaluateComponentsStage } from "./stages/04-evaluate-components.stage";
import { EmployerCostStage } from "./stages/12-employer-cost.stage";
import { InsuranceStage } from "./stages/07-insurance.stage";
import { LoadEmployeeStage } from "./stages/02-load-employee.stage";
import { LoadRulesStage } from "./stages/01-load-rules.stage";
import { LoadWorkLogStage } from "./stages/03-load-worklog.stage";
import { NetSalaryStage } from "./stages/11-net-salary.stage";
import { OtherDeductionsStage } from "./stages/10-other-deductions.stage";
import { StoreResultStage } from "./stages/13-store-result.stage";
import { TaxStage } from "./stages/09-tax.stage";

const RULE_VERSION_ROW = {
  id: "rv-1",
  rules: [
    { code: "HOUSE_RATE", value: "20" },
    { code: "OVERTIME_RATE", value: "500000" },
    { code: "INSURANCE_RATE_EMPLOYEE", value: "7" },
    { code: "INSURANCE_RATE_EMPLOYER", value: "23" },
    { code: "UNEMPLOYMENT_RATE", value: "3" },
    { code: "TAX_EXEMPTION", value: "10000000" },
  ],
  brackets: [
    { bracketOrder: 1, fromAmount: "0", toAmount: "10000000", ratePercent: "10" },
    { bracketOrder: 2, fromAmount: "10000000", toAmount: null, ratePercent: "20" },
  ],
};

const PERIOD_ROW = {
  id: "period-1",
  monthNumber: 1,
  ruleVersionId: "rv-1",
  payrollYear: { yearNumber: 1406, calendarType: "jalali" },
};

const EMPLOYEE_ROW = { id: "emp-1", maritalStatus: "married", hireDate: new Date(2020, 0, 1) };
const CONTRACT_ROW = {
  baseSalary: "50000000",
  salaryCurrency: "IRR",
  startDate: new Date(2020, 0, 1),
  endDate: null,
};
const PROFILE_ROW = { childrenCount: 1, seniorityBaseDate: null };
const WORKLOG_ROW = {
  workedDays: "30",
  overtimeHours: "10",
  nightHours: "0",
  fridayHours: "0",
  holidayHours: "0",
  missionDays: "0",
  leaveDays: "0",
  absenceDays: "0",
  latenessMinutes: 0,
  earlyLeaveMinutes: 0,
  requiredHours: "0",
  workedHours: "0",
};

const COMPONENT_ROWS = [
  {
    id: "c-base",
    code: "BASE",
    componentType: "earning",
    isInsurable: true,
    isTaxable: true,
    calcOrder: 1,
    formula: { expression: "BASE_SALARY" },
  },
  {
    id: "c-house",
    code: "HOUSE",
    componentType: "earning",
    isInsurable: true,
    isTaxable: true,
    calcOrder: 2,
    formula: { expression: "PERCENT(BASE, HOUSE_RATE)" },
  },
  {
    id: "c-overtime",
    code: "OVERTIME",
    componentType: "earning",
    isInsurable: false,
    isTaxable: true,
    calcOrder: 3,
    formula: { expression: "OVERTIME_HOURS * OVERTIME_RATE" },
  },
  {
    id: "c-loan",
    code: "LOAN",
    componentType: "deduction",
    isInsurable: false,
    isTaxable: false,
    calcOrder: 4,
    formula: { expression: "1500000" },
  },
];

function buildPrisma() {
  const prisma: any = {
    payrollPeriod: { findUnique: jest.fn().mockResolvedValue(PERIOD_ROW) },
    employee: {
      findUnique: jest.fn().mockResolvedValue(EMPLOYEE_ROW),
      findMany: jest.fn().mockResolvedValue([{ id: "emp-1" }]),
    },
    employeeContract: { findFirst: jest.fn().mockResolvedValue(CONTRACT_ROW) },
    employeePayrollProfile: { findUnique: jest.fn().mockResolvedValue(PROFILE_ROW) },
    employeeChild: { findMany: jest.fn().mockResolvedValue([]) },
    payrollWorkLog: { findUnique: jest.fn().mockResolvedValue(WORKLOG_ROW) },
    payrollRuleVersion: { findUnique: jest.fn().mockResolvedValue(RULE_VERSION_ROW) },
    payrollComponent: { findMany: jest.fn().mockResolvedValue(COMPONENT_ROWS) },
    payrollResult: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) =>
        Promise.resolve({ id: "result-1", ...(data as object) }),
      ),
      update: jest.fn(),
    },
    payrollResultItem: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  return prisma;
}

function buildProcessor(prisma: ReturnType<typeof buildPrisma>) {
  const formulaEngine = new FormulaEngineService();
  const dependencyEngine = new DependencyEngineService(formulaEngine);
  const componentEvaluator = new ComponentEvaluatorService(formulaEngine, dependencyEngine);
  const ruleEngine = new RuleEngineService(prisma);
  const insuranceEngine = new InsuranceEngineService();
  const taxEngine = new TaxEngineService();
  const componentRepository = new PayrollComponentRepository(prisma);
  const resultRepository = new PayrollResultRepository(prisma);

  return new PayrollProcessorService(
    prisma,
    new LoadRulesStage(prisma, ruleEngine),
    new LoadEmployeeStage(prisma),
    new LoadWorkLogStage(prisma),
    new EvaluateComponentsStage(componentRepository, componentEvaluator),
    new CalculateEarningsStage(),
    new CalculateInsuranceBaseStage(),
    new InsuranceStage(insuranceEngine),
    new CalculateTaxableIncomeStage(),
    new TaxStage(taxEngine),
    new OtherDeductionsStage(),
    new NetSalaryStage(),
    new EmployerCostStage(),
    new StoreResultStage(resultRepository),
  );
}

describe("PayrollProcessorService — end-to-end با Engineهای واقعی و Prisma موک‌شده", () => {
  it("یک محاسبه‌ی کامل حقوق را دقیقاً طبق ترتیب ۱۳ مرحله‌ای معماری مصوب انجام می‌دهد", async () => {
    const prisma = buildPrisma();
    const processor = buildProcessor(prisma);

    const ctx = await processor.calculateForEmployee("period-1", "emp-1");

    // BASE=50م، HOUSE=PERCENT(50م,20)=10م، OVERTIME=10*500هزار=5م → ناخالص=65م
    expect(ctx.grossEarnings).toBe(65_000_000);
    // مبنای بیمه فقط BASE+HOUSE (isInsurable) = 60م
    expect(ctx.insuranceBase).toBe(60_000_000);
    expect(ctx.insuranceResult).toEqual({
      insuranceBase: 60_000_000,
      employeeShare: 4_200_000,
      employerShare: 13_800_000,
      unemploymentShare: 1_800_000,
      total: 19_800_000,
    });
    // مشمول مالیات = ۶۵م (BASE+HOUSE+OVERTIME) - سهم بیمه‌ی کارگر ۴.۲م = ۶۰.۸م
    expect(ctx.taxableIncome).toBe(60_800_000);
    // معافیت ۱۰م؛ پله۱: ۱۰م×۱۰٪=۱م؛ پله۲ باز: (۶۰.۸م-۱۰م-۱۰م)=۴۰.۸م×۲۰٪=۸.۱۶م → جمع ۹.۱۶م
    expect(ctx.taxAmount).toBe(9_160_000);
    expect(ctx.otherDeductions).toBe(1_500_000); // LOAN
    expect(ctx.netSalary).toBe(50_140_000); // 65م-4.2م-9.16م-1.5م
    expect(ctx.employerCost).toBe(80_600_000); // 65م+13.8م+1.8م
    expect(ctx.savedResultId).toBe("result-1");
  });

  it("نتیجه را با ستون‌های صحیح در PayrollResultRepository ذخیره می‌کند", async () => {
    const prisma = buildPrisma();
    const processor = buildProcessor(prisma);

    await processor.calculateForEmployee("period-1", "emp-1");

    expect(prisma.payrollResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payrollPeriodId: "period-1",
        employeeId: "emp-1",
        grossEarnings: 65_000_000,
        totalDeductions: 4_200_000 + 9_160_000 + 1_500_000,
        insuranceEmployeeShare: 4_200_000,
        insuranceEmployerShare: 13_800_000,
        unemploymentInsurance: 1_800_000,
        taxAmount: 9_160_000,
        netSalary: 50_140_000,
        employerCost: 80_600_000,
        status: "calculated",
      }),
    });
  });

  it("ردیف‌های PayrollResultItem را برای هر جزء (BASE/HOUSE/OVERTIME/LOAN) ذخیره می‌کند", async () => {
    const prisma = buildPrisma();
    const processor = buildProcessor(prisma);

    await processor.calculateForEmployee("period-1", "emp-1");

    const [[call]] = prisma.payrollResultItem.createMany.mock.calls;
    const codes = call.data.map((item: { componentCode: string }) => item.componentCode).sort();
    expect(codes).toEqual(["BASE", "HOUSE", "LOAN", "OVERTIME"]);
  });

  it("calculateForPeriod همه‌ی کارمندهای فعال دارای پروفایل حقوقی را پردازش می‌کند", async () => {
    const prisma = buildPrisma();
    prisma.employee.findMany.mockResolvedValue([{ id: "emp-1" }]);
    const processor = buildProcessor(prisma);

    const outcomes = await processor.calculateForPeriod("period-1");

    expect(outcomes).toEqual([{ employeeId: "emp-1", status: "ok", resultId: "result-1" }]);
  });

  it("در calculateForPeriod، خطای یک کارمند بقیه را متوقف نمی‌کند", async () => {
    const prisma = buildPrisma();
    prisma.employee.findMany.mockResolvedValue([{ id: "emp-bad" }, { id: "emp-1" }]);
    prisma.employeeContract.findFirst.mockImplementation(({ where }: { where: { employeeId: string } }) =>
      Promise.resolve(where.employeeId === "emp-bad" ? null : CONTRACT_ROW),
    );
    const processor = buildProcessor(prisma);

    const outcomes = await processor.calculateForPeriod("period-1");

    expect(outcomes[0].status).toBe("error");
    expect(outcomes[0].error).toContain(new EmployeeContractNotFoundError("emp-bad").message);
    expect(outcomes[1]).toEqual({ employeeId: "emp-1", status: "ok", resultId: "result-1" });
  });
});
