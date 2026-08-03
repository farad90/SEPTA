import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { getRuleValue } from "../../engines/rule-engine/rule-set.types";
import { periodDateRange } from "../../worklog/period-date-range";
import { EmployeeContractNotFoundError } from "../errors";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";
import { countEligibleChildren } from "./child-eligibility";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * مرحله ۲: بارگذاری کارمند — عمداً از employee_contracts/employees می‌خواند (نه تکرار
 * فیلد در EmployeePayrollProfile)، مطابق تصمیم معماری «Reuse-over-duplication».
 */
@Injectable()
export class LoadEmployeeStage implements PayrollPipelineStage {
  readonly name = "load_employee";

  constructor(private readonly prisma: PrismaService) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    const period = ctx.period!;
    const { start, end } = periodDateRange(period.calendarType, period.yearNumber, period.monthNumber);

    const [employee, contract, profile, children] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: ctx.employeeId } }),
      this.prisma.employeeContract.findFirst({
        where: {
          employeeId: ctx.employeeId,
          status: "active",
          startDate: { lte: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }],
        },
        orderBy: { startDate: "desc" },
      }),
      this.prisma.employeePayrollProfile.findUnique({ where: { employeeId: ctx.employeeId } }),
      this.prisma.employeeChild.findMany({ where: { employeeId: ctx.employeeId } }),
    ]);

    if (!contract) throw new EmployeeContractNotFoundError(ctx.employeeId);

    const seniorityBaseDate = profile?.seniorityBaseDate ?? employee?.hireDate ?? start;
    const seniorityYears = Math.max(0, (start.getTime() - seniorityBaseDate.getTime()) / MS_PER_YEAR);
    const childAllowanceMaxAge = getRuleValue(ctx.ruleSet!, "CHILD_ALLOWANCE_MAX_AGE", Number.POSITIVE_INFINITY);
    const eligibleChildrenCount = countEligibleChildren(children, start, childAllowanceMaxAge);

    ctx.currencyCode = contract.salaryCurrency;
    ctx.employeeInputs = {
      BASE_SALARY: Number(contract.baseSalary),
      CHILDREN_COUNT: eligibleChildrenCount,
      SENIORITY_YEARS: seniorityYears,
      IS_MARRIED: employee?.maritalStatus === "married",
    };
  }
}
