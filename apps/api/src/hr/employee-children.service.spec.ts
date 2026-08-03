import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeeChildrenService } from "./employee-children.service";

function buildPrisma() {
  return {
    employeeChild: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe("EmployeeChildrenService", () => {
  it("listForEmployee: فرزندان یک پرسنل را جدیدترین‌تولد‌اول برمی‌گرداند", async () => {
    const prisma = buildPrisma();
    const service = new EmployeeChildrenService(prisma as unknown as PrismaService);

    await service.listForEmployee("emp-1");

    expect(prisma.employeeChild.findMany).toHaveBeenCalledWith({
      where: { employeeId: "emp-1" },
      orderBy: { birthDate: "desc" },
    });
  });

  it("create: تاریخ تولد را به Date واقعی تبدیل می‌کند و employeeId را ست می‌کند", async () => {
    const prisma = buildPrisma();
    prisma.employeeChild.create.mockResolvedValue({ id: "c1" });
    const service = new EmployeeChildrenService(prisma as unknown as PrismaService);

    await service.create("emp-1", { fullName: "علی", birthDate: "2015-01-01" });

    const data = prisma.employeeChild.create.mock.calls[0][0].data;
    expect(data.employeeId).toBe("emp-1");
    expect(data.fullName).toBe("علی");
    expect(data.birthDate).toBeInstanceOf(Date);
  });

  it("delete: وقتی رکورد وجود نداشته باشد NotFoundException می‌دهد", async () => {
    const prisma = buildPrisma();
    prisma.employeeChild.findUnique.mockResolvedValue(null);
    const service = new EmployeeChildrenService(prisma as unknown as PrismaService);

    await expect(service.delete("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employeeChild.delete).not.toHaveBeenCalled();
  });

  it("delete: رکورد موجود را حذف می‌کند", async () => {
    const prisma = buildPrisma();
    prisma.employeeChild.findUnique.mockResolvedValue({ id: "c1" });
    const service = new EmployeeChildrenService(prisma as unknown as PrismaService);

    await service.delete("c1");

    expect(prisma.employeeChild.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
