import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { EmployeeLoansService } from "./employee-loans.service";

function buildPrisma() {
  return {
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    employeeLoan: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    employeeLoanInstallment: {
      createMany: jest.fn(),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const p = prisma as unknown as PrismaService;
  return new EmployeeLoansService(p, new HrAccessService(p));
}

const CREATE_DTO = {
  loanAmount: 12000000,
  currencyCode: "IRR",
  installmentCount: 12,
  startDeductionDate: "2026-04-01",
};

describe("EmployeeLoansService", () => {
  it("create: rejects self-service when the user has no linked employee record", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.create("user-1", CREATE_DTO)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employeeLoan.create).not.toHaveBeenCalled();
  });

  it("create: computes the monthly installment as loanAmount / installmentCount", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.employeeLoan.create.mockResolvedValue({ id: "loan-1" });
    const service = buildService(prisma);

    await service.create("user-1", CREATE_DTO);

    expect(prisma.employeeLoan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeId: "emp-1", monthlyInstallment: 1000000 }),
      }),
    );
  });

  it("approve: rejects when the caller isn't the requester's direct manager", async () => {
    const prisma = buildPrisma();
    prisma.employeeLoan.findUnique.mockResolvedValue({
      id: "loan-1",
      employeeId: "emp-1",
      status: "pending",
      installmentCount: 12,
      monthlyInstallment: 1000000,
      startDeductionDate: new Date("2026-04-01"),
    });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "someone-else" });
    const service = buildService(prisma);

    await expect(service.approve("user-1", "loan-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employeeLoanInstallment.createMany).not.toHaveBeenCalled();
  });

  it("approve: rejects when the loan is no longer pending", async () => {
    const prisma = buildPrisma();
    prisma.employeeLoan.findUnique.mockResolvedValue({
      id: "loan-1",
      employeeId: "emp-1",
      status: "active",
      installmentCount: 12,
      monthlyInstallment: 1000000,
      startDeductionDate: new Date("2026-04-01"),
    });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "manager-a" });
    const service = buildService(prisma);

    await expect(service.approve("user-1", "loan-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("approve: generates the exact installment count with sequential monthly due dates, then activates the loan", async () => {
    const prisma = buildPrisma();
    const startDeductionDate = new Date("2026-04-01");
    prisma.employeeLoan.findUnique.mockResolvedValue({
      id: "loan-1",
      employeeId: "emp-1",
      status: "pending",
      installmentCount: 3,
      monthlyInstallment: 1000000,
      startDeductionDate,
    });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "manager-a" });
    prisma.employeeLoan.update.mockResolvedValue({ id: "loan-1", status: "active" });
    const service = buildService(prisma);

    await service.approve("user-1", "loan-1");

    expect(prisma.employeeLoanInstallment.createMany).toHaveBeenCalledWith({
      data: [
        { loanId: "loan-1", installmentNumber: 1, dueDate: new Date(Date.UTC(2026, 3, 1)), amount: 1000000 },
        { loanId: "loan-1", installmentNumber: 2, dueDate: new Date(Date.UTC(2026, 4, 1)), amount: 1000000 },
        { loanId: "loan-1", installmentNumber: 3, dueDate: new Date(Date.UTC(2026, 5, 1)), amount: 1000000 },
      ],
    });
    expect(prisma.employeeLoan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "active", approverId: "manager-a" }) }),
    );
  });

  it("cancel: maps self-cancellation to 'rejected' since employee_loans has no 'cancelled' state", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.employeeLoan.findUnique.mockResolvedValue({ id: "loan-1", employeeId: "emp-1", status: "pending" });
    prisma.employeeLoan.update.mockResolvedValue({ id: "loan-1", status: "rejected" });
    const service = buildService(prisma);

    await service.cancel("user-1", "loan-1");

    expect(prisma.employeeLoan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "rejected" } }),
    );
  });

  it("approve: throws NotFound for a nonexistent loan", async () => {
    const prisma = buildPrisma();
    prisma.employeeLoan.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.approve("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
