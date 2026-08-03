import { PrismaService } from "../prisma/prisma.service";
import { EmployeeBenefitsService } from "./employee-benefits.service";

function buildPrisma() {
  return {
    employeeBenefit: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe("EmployeeBenefitsService", () => {
  it("create: converts effectiveFrom/effectiveTo to real Date objects before calling Prisma", async () => {
    const prisma = buildPrisma();
    prisma.employeeBenefit.create.mockResolvedValue({ id: "b1" });
    const service = new EmployeeBenefitsService(prisma as unknown as PrismaService);

    await service.create("emp-1", {
      benefitTypeId: "bt-1",
      amount: 100,
      currencyCode: "IRR",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
    });

    const data = prisma.employeeBenefit.create.mock.calls[0][0].data;
    expect(data.effectiveFrom).toBeInstanceOf(Date);
    expect(data.effectiveTo).toBeInstanceOf(Date);
    expect(data.employeeId).toBe("emp-1");
  });

  it("create: leaves effectiveTo undefined when not provided", async () => {
    const prisma = buildPrisma();
    prisma.employeeBenefit.create.mockResolvedValue({ id: "b1" });
    const service = new EmployeeBenefitsService(prisma as unknown as PrismaService);

    await service.create("emp-1", {
      benefitTypeId: "bt-1",
      amount: 100,
      currencyCode: "IRR",
      effectiveFrom: "2026-01-01",
    });

    const data = prisma.employeeBenefit.create.mock.calls[0][0].data;
    expect(data.effectiveTo).toBeUndefined();
  });
});
