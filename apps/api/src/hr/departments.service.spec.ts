import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DepartmentsService } from "./departments.service";

function buildPrisma() {
  return {
    department: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
  };
}

describe("DepartmentsService", () => {
  it("throws NotFound when updating a missing department", async () => {
    const prisma = buildPrisma();
    prisma.department.findUnique.mockResolvedValue(null);
    const service = new DepartmentsService(prisma as unknown as PrismaService);

    await expect(service.update("missing-id", {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("rejects a headEmployeeId that doesn't belong to the department", async () => {
    const prisma = buildPrisma();
    prisma.department.findUnique.mockResolvedValue({ id: "dept-1" });
    prisma.employee.findUnique.mockResolvedValue({ departmentId: "dept-2" });
    const service = new DepartmentsService(prisma as unknown as PrismaService);

    await expect(
      service.update("dept-1", { headEmployeeId: "emp-1" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.department.update).not.toHaveBeenCalled();
  });

  it("throws NotFound when headEmployeeId references a nonexistent employee", async () => {
    const prisma = buildPrisma();
    prisma.department.findUnique.mockResolvedValue({ id: "dept-1" });
    prisma.employee.findUnique.mockResolvedValue(null);
    const service = new DepartmentsService(prisma as unknown as PrismaService);

    await expect(
      service.update("dept-1", { headEmployeeId: "emp-missing" } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("accepts a headEmployeeId that belongs to the department", async () => {
    const prisma = buildPrisma();
    prisma.department.findUnique.mockResolvedValue({ id: "dept-1" });
    prisma.employee.findUnique.mockResolvedValue({ departmentId: "dept-1" });
    prisma.department.update.mockResolvedValue({ id: "dept-1" });
    const service = new DepartmentsService(prisma as unknown as PrismaService);

    await service.update("dept-1", { headEmployeeId: "emp-1" } as never);
    expect(prisma.department.update).toHaveBeenCalled();
  });

  it("allows clearing headEmployeeId without a membership check", async () => {
    const prisma = buildPrisma();
    prisma.department.findUnique.mockResolvedValue({ id: "dept-1" });
    prisma.department.update.mockResolvedValue({ id: "dept-1" });
    const service = new DepartmentsService(prisma as unknown as PrismaService);

    await service.update("dept-1", { headEmployeeId: null } as never);
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(prisma.department.update).toHaveBeenCalled();
  });
});
