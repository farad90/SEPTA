import { PrismaService } from "../../prisma/prisma.service";
import { PayrollAuditLogService } from "./payroll-audit-log.service";

function buildPrisma() {
  const prisma: any = {
    payrollAuditLog: { create: jest.fn(), findMany: jest.fn() },
  };
  return prisma;
}

describe("PayrollAuditLogService", () => {
  it("log یک رکورد را دقیقاً با فیلدهای داده‌شده ثبت می‌کند", async () => {
    const prisma = buildPrisma();
    const service = new PayrollAuditLogService(prisma as unknown as PrismaService);

    await service.log({
      entityType: "payroll_result",
      entityId: "r1",
      action: "status_changed",
      performedBy: "u1",
      fieldName: "status",
      oldValue: "calculated",
      newValue: "reviewed",
    });

    expect(prisma.payrollAuditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "payroll_result",
        entityId: "r1",
        action: "status_changed",
        performedBy: "u1",
        fieldName: "status",
        oldValue: "calculated",
        newValue: "reviewed",
      },
    });
  });

  it("listForEntity رکوردهای یک موجودیت را جدیدترین‌اول برمی‌گرداند", async () => {
    const prisma = buildPrisma();
    const service = new PayrollAuditLogService(prisma as unknown as PrismaService);

    await service.listForEntity("payroll_result", "r1");

    expect(prisma.payrollAuditLog.findMany).toHaveBeenCalledWith({
      where: { entityType: "payroll_result", entityId: "r1" },
      orderBy: { performedAt: "desc" },
    });
  });
});
