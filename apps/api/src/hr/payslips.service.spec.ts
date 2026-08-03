import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { PayslipsService } from "./payslips.service";

function buildPrisma() {
  const prisma: any = {
    legacyPayrollPeriod: { findUnique: jest.fn() },
    employee: { findUnique: jest.fn(), findFirst: jest.fn() },
    legacyPayslip: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    employeeContract: { findFirst: jest.fn() },
    employeeBenefit: { findMany: jest.fn().mockResolvedValue([]) },
    overtimeRecord: { findMany: jest.fn().mockResolvedValue([]) },
    employeeDeduction: { findMany: jest.fn().mockResolvedValue([]) },
    employeeLoanInstallment: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const p = prisma as unknown as PrismaService;
  return new PayslipsService(p, new HrAccessService(p));
}

const PERIOD = { id: "period-1", status: "draft", periodMonth: 4, periodYear: 2026 };
const CONTRACT = { baseSalary: 50000000, salaryCurrency: "IRR" };

describe("PayslipsService.generate", () => {
  it("rejects when the payroll period doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.generate("missing", "emp-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects when the period is no longer draft", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue({ ...PERIOD, status: "finalized" });
    const service = buildService(prisma);

    await expect(service.generate("period-1", "emp-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when the employee doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(PERIOD);
    prisma.employee.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.generate("period-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects regeneration when the existing payslip is locked (finalized/paid)", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(PERIOD);
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.legacyPayslip.findUnique.mockResolvedValue({ id: "old-payslip", status: "finalized" });
    const service = buildService(prisma);

    await expect(service.generate("period-1", "emp-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.legacyPayslip.delete).not.toHaveBeenCalled();
  });

  it("rejects when no active contract covers the period", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(PERIOD);
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.legacyPayslip.findUnique.mockResolvedValue(null);
    prisma.employeeContract.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.generate("period-1", "emp-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("aggregates base salary + benefits + approved overtime + deductions + due loan installments into the correct totals", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(PERIOD);
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.legacyPayslip.findUnique.mockResolvedValue(null);
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT);
    prisma.employeeBenefit.findMany.mockResolvedValue([
      { amount: 3000000, benefitType: { benefitName: "حق مسکن" } },
    ]);
    prisma.overtimeRecord.findMany.mockResolvedValue([{ calculatedAmount: 1500000 }, { calculatedAmount: 500000 }]);
    prisma.employeeDeduction.findMany.mockResolvedValue([
      { amount: 2000000, deductionType: { deductionName: "بیمه" } },
    ]);
    prisma.employeeLoanInstallment.findMany.mockResolvedValue([
      { id: "inst-1", installmentNumber: 2, amount: 1000000 },
    ]);
    prisma.legacyPayslip.create.mockImplementation(({ data }: any) => ({ id: "new-payslip", ...data, items: data.items.create }));
    const service = buildService(prisma);

    const result = await service.generate("period-1", "emp-1");

    expect(result.baseSalary).toBe(50000000);
    expect(result.totalBenefits).toBe(3000000);
    expect(result.totalOvertime).toBe(2000000);
    expect(result.totalDeductions).toBe(3000000); // 2,000,000 deduction + 1,000,000 installment
    expect(result.netAmount).toBe(50000000 + 3000000 + 2000000 - 3000000);
    expect(result.currencyCode).toBe("IRR");
  });

  it("closes the loan-installment loop: marks due installments as deducted and links deducted_in_payslip_id", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(PERIOD);
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.legacyPayslip.findUnique.mockResolvedValue(null);
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT);
    prisma.employeeLoanInstallment.findMany.mockResolvedValue([
      { id: "inst-1", installmentNumber: 1, amount: 1000000 },
      { id: "inst-2", installmentNumber: 2, amount: 1000000 },
    ]);
    prisma.legacyPayslip.create.mockResolvedValue({ id: "new-payslip" });
    const service = buildService(prisma);

    await service.generate("period-1", "emp-1");

    expect(prisma.employeeLoanInstallment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["inst-1", "inst-2"] } },
      data: { status: "deducted", deductedInPayslipId: "new-payslip" },
    });
  });

  it("regeneration of an existing draft payslip resets its previously-deducted installments before rebuilding", async () => {
    const prisma = buildPrisma();
    prisma.legacyPayrollPeriod.findUnique.mockResolvedValue(PERIOD);
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1" });
    prisma.legacyPayslip.findUnique.mockResolvedValue({ id: "old-payslip", status: "draft" });
    prisma.employeeContract.findFirst.mockResolvedValue(CONTRACT);
    prisma.legacyPayslip.create.mockResolvedValue({ id: "new-payslip" });
    const service = buildService(prisma);

    await service.generate("period-1", "emp-1");

    expect(prisma.employeeLoanInstallment.updateMany).toHaveBeenCalledWith({
      where: { deductedInPayslipId: "old-payslip" },
      data: { status: "pending", deductedInPayslipId: null },
    });
    expect(prisma.legacyPayslip.delete).toHaveBeenCalledWith({ where: { id: "old-payslip" } });
  });
});
