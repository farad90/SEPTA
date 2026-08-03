import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeesService } from "./employees.service";

function buildPrisma() {
  return {
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employeeContract: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
}

describe("EmployeesService", () => {
  it("rejects a duplicate employee number on create", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "existing" });
    const service = new EmployeesService(prisma as unknown as PrismaService);

    await expect(
      service.create({ employeeNumber: "1001", fullName: "علی", ourEntityId: "e1", hireDate: "2026-01-01" } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it("creates an employee when the number is free", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue({ id: "emp-1" });
    const service = new EmployeesService(prisma as unknown as PrismaService);

    await service.create({ employeeNumber: "1001", fullName: "علی", ourEntityId: "e1", hireDate: "2026-01-01" } as never);
    expect(prisma.employee.create).toHaveBeenCalled();
  });

  it("throws NotFound when updating a missing employee", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    const service = new EmployeesService(prisma as unknown as PrismaService);

    await expect(service.update("missing-id", {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("finds similar employees by name via pg_trgm", async () => {
    const prisma = buildPrisma();
    prisma.$queryRaw.mockResolvedValue([{ id: "e1", fullName: "علی رضایی", employeeNumber: "1001", similarity: 0.5 }]);
    const service = new EmployeesService(prisma as unknown as PrismaService);

    const result = await service.findSimilar("علی رضا");
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("throws NotFound when adding a contract for a missing employee", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    const service = new EmployeesService(prisma as unknown as PrismaService);

    await expect(
      service.addContract("missing-id", { ourEntityId: "e1", contractType: "permanent", startDate: "2026-01-01", baseSalary: 1000, salaryCurrency: "IRR" } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFound when updating a missing contract", async () => {
    const prisma = buildPrisma();
    prisma.employeeContract.findUnique.mockResolvedValue(null);
    const service = new EmployeesService(prisma as unknown as PrismaService);

    await expect(service.updateContract("missing-id", {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
