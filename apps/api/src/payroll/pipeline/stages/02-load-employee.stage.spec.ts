import { PrismaService } from "../../../prisma/prisma.service";
import { RuleSet } from "../../engines/rule-engine/rule-set.types";
import { EmployeeContractNotFoundError } from "../errors";
import { PayrollPipelineContext } from "../pipeline-context";
import { LoadEmployeeStage } from "./02-load-employee.stage";

function buildPrisma() {
  const prisma: any = {
    employee: { findUnique: jest.fn() },
    employeeContract: { findFirst: jest.fn() },
    employeePayrollProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    employeeChild: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return prisma;
}

function buildStage(prisma: ReturnType<typeof buildPrisma>) {
  return new LoadEmployeeStage(prisma as unknown as PrismaService);
}

function ruleSet(values: Record<string, number>): RuleSet {
  return { ruleVersionId: "v1", values, brackets: [] };
}

function baseCtx(rules: Record<string, number>): PayrollPipelineContext {
  return {
    payrollPeriodId: "period-1",
    employeeId: "emp-1",
    period: { id: "period-1", monthNumber: 5, yearNumber: 2026, calendarType: "gregorian", ruleVersionId: "v1" },
    ruleSet: ruleSet(rules),
  };
}

const EMPLOYEE_ROW = { hireDate: new Date(2020, 0, 1), maritalStatus: "married" };
const CONTRACT_ROW = { baseSalary: 50000000, salaryCurrency: "IRR" };

describe("LoadEmployeeStage", () => {
  it("وقتی قرارداد فعالی پیدا نشود، EmployeeContractNotFoundError می‌دهد", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(EMPLOYEE_ROW);
    prisma.employeeContract.findFirst.mockResolvedValue(null);
    const stage = buildStage(prisma);

    await expect(stage.execute(baseCtx({}))).rejects.toBeInstanceOf(EmployeeContractNotFoundError);
  });

  it("CHILDREN_COUNT فقط فرزندان زیر سقف سنی تنظیم‌شده را می‌شمارد", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(EMPLOYEE_ROW);
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT_ROW);
    prisma.employeeChild.findMany.mockResolvedValue([
      { birthDate: new Date(2015, 0, 1) }, // ۱۱ ساله — واجد شرایط
      { birthDate: new Date(2000, 0, 1) }, // بالای سن — حذف می‌شود
    ]);
    const stage = buildStage(prisma);

    const ctx = baseCtx({ CHILD_ALLOWANCE_MAX_AGE: 18 });
    await stage.execute(ctx);

    expect(ctx.employeeInputs!.CHILDREN_COUNT).toBe(1);
  });

  it("وقتی CHILD_ALLOWANCE_MAX_AGE تنظیم نشده باشد، همه‌ی فرزندان بدون محدودیت سنی شمرده می‌شوند", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(EMPLOYEE_ROW);
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT_ROW);
    prisma.employeeChild.findMany.mockResolvedValue([
      { birthDate: new Date(2015, 0, 1) },
      { birthDate: new Date(1990, 0, 1) },
    ]);
    const stage = buildStage(prisma);

    const ctx = baseCtx({}); // بدون CHILD_ALLOWANCE_MAX_AGE
    await stage.execute(ctx);

    expect(ctx.employeeInputs!.CHILDREN_COUNT).toBe(2);
  });

  it("بدون هیچ فرزندی، CHILDREN_COUNT صفر است", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(EMPLOYEE_ROW);
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT_ROW);
    const stage = buildStage(prisma);

    const ctx = baseCtx({ CHILD_ALLOWANCE_MAX_AGE: 18 });
    await stage.execute(ctx);

    expect(ctx.employeeInputs!.CHILDREN_COUNT).toBe(0);
  });

  it("BASE_SALARY/IS_MARRIED را از contract/employees می‌خواند (نه از EmployeePayrollProfile)", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(EMPLOYEE_ROW);
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT_ROW);
    const stage = buildStage(prisma);

    const ctx = baseCtx({});
    await stage.execute(ctx);

    expect(ctx.employeeInputs!.BASE_SALARY).toBe(50000000);
    expect(ctx.employeeInputs!.IS_MARRIED).toBe(true);
    expect(ctx.currencyCode).toBe("IRR");
  });
});
