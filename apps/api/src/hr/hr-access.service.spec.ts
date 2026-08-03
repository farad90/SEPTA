import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";

function buildPrisma() {
  return {
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe("HrAccessService", () => {
  it("assertMyEmployee throws Forbidden when the user has no linked employee record", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue(null);
    const service = new HrAccessService(prisma as unknown as PrismaService);

    await expect(service.assertMyEmployee("user-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("assertMyEmployee returns the linked employee when it exists", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1", userId: "user-1" });
    const service = new HrAccessService(prisma as unknown as PrismaService);

    const result = await service.assertMyEmployee("user-1");
    expect(result.id).toBe("emp-1");
  });

  it("assertIsDirectManagerOf throws NotFound when the target employee doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    const service = new HrAccessService(prisma as unknown as PrismaService);

    await expect(service.assertIsDirectManagerOf("user-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("assertIsDirectManagerOf throws Forbidden when the caller isn't the direct manager", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "manager-b", userId: "user-1" });
    const service = new HrAccessService(prisma as unknown as PrismaService);

    await expect(service.assertIsDirectManagerOf("user-1", "emp-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("assertIsDirectManagerOf throws Forbidden when the caller has no linked employee at all", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue(null);
    const service = new HrAccessService(prisma as unknown as PrismaService);

    await expect(service.assertIsDirectManagerOf("user-1", "emp-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("assertIsDirectManagerOf succeeds when the caller is the direct manager", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "manager-a", userId: "user-1" });
    const service = new HrAccessService(prisma as unknown as PrismaService);

    const result = await service.assertIsDirectManagerOf("user-1", "emp-1");
    expect(result.manager.id).toBe("manager-a");
    expect(result.target.id).toBe("emp-1");
  });
});
