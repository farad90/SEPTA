import { PrismaService } from "../../prisma/prisma.service";
import { PayrollPeriodNotFoundError } from "./errors";
import { WorkLogAggregatorService } from "./worklog-aggregator.service";

function buildPrisma() {
  const prisma: any = {
    payrollPeriod: { findUnique: jest.fn() },
    employee: { findMany: jest.fn() },
    payrollWorkLog: { findUnique: jest.fn(), upsert: jest.fn() },
    attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    overtimeRecord: { findMany: jest.fn().mockResolvedValue([]) },
    leaveRequest: { findMany: jest.fn().mockResolvedValue([]) },
    missionRequest: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return prisma;
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new WorkLogAggregatorService(prisma as unknown as PrismaService);
}

const PERIOD = {
  id: "period-1",
  monthNumber: 1,
  payrollYear: { yearNumber: 1406, calendarType: "jalali" },
};

describe("WorkLogAggregatorService", () => {
  describe("aggregateForPeriod", () => {
    it("وقتی دوره پیدا نشود، PayrollPeriodNotFoundError پرتاب می‌کند", async () => {
      const prisma = buildPrisma();
      prisma.payrollPeriod.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);

      await expect(service.aggregateForPeriod("missing")).rejects.toBeInstanceOf(PayrollPeriodNotFoundError);
    });

    it("فقط کارمندهای فعال با پروفایل حقوقی را پردازش می‌کند", async () => {
      const prisma = buildPrisma();
      prisma.payrollPeriod.findUnique.mockResolvedValue(PERIOD);
      prisma.employee.findMany.mockResolvedValue([{ id: "emp-1" }, { id: "emp-2" }]);
      prisma.payrollWorkLog.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);

      const result = await service.aggregateForPeriod("period-1");

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { employmentStatus: "active", payrollProfile: { isNot: null } },
        select: { id: true },
      });
      expect(result).toEqual({ processed: 2, skippedManual: 0 });
    });

    it("رکورد دستی (source='manual') را رد می‌کند و دست‌نمی‌زند", async () => {
      const prisma = buildPrisma();
      prisma.payrollPeriod.findUnique.mockResolvedValue(PERIOD);
      prisma.employee.findMany.mockResolvedValue([{ id: "emp-1" }]);
      prisma.payrollWorkLog.findUnique.mockResolvedValue({ source: "manual" });
      const service = buildService(prisma);

      const result = await service.aggregateForPeriod("period-1");

      expect(prisma.payrollWorkLog.upsert).not.toHaveBeenCalled();
      expect(result).toEqual({ processed: 0, skippedManual: 1 });
    });
  });

  describe("aggregateForEmployee", () => {
    const START = new Date(2026, 2, 1);
    const END = new Date(2026, 3, 1);

    it("worked_days را از رکوردهای present/mission، absence_days را از absent می‌شمارد", async () => {
      const prisma = buildPrisma();
      prisma.payrollWorkLog.findUnique.mockResolvedValue(null);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { status: "present", checkInTime: null, checkOutTime: null },
        { status: "present", checkInTime: null, checkOutTime: null },
        { status: "mission", checkInTime: null, checkOutTime: null },
        { status: "absent", checkInTime: null, checkOutTime: null },
      ]);
      const service = buildService(prisma);

      await service.aggregateForEmployee("period-1", "emp-1", START, END);

      expect(prisma.payrollWorkLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ workedDays: 3, absenceDays: 1 }),
        }),
      );
    });

    it("overtime_hours را فقط از رکوردهای approved/paid جمع می‌زند (فیلتر status در Query اعمال می‌شود)", async () => {
      const prisma = buildPrisma();
      prisma.payrollWorkLog.findUnique.mockResolvedValue(null);
      prisma.overtimeRecord.findMany.mockResolvedValue([{ hours: 2.5 }, { hours: 1.5 }]);
      const service = buildService(prisma);

      await service.aggregateForEmployee("period-1", "emp-1", START, END);

      expect(prisma.overtimeRecord.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: "emp-1",
          workDate: { gte: START, lt: END },
          status: { in: ["approved", "paid"] },
        },
      });
      expect(prisma.payrollWorkLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ overtimeHours: 4 }) }),
      );
    });

    it("workedHours را از فاصله‌ی checkIn/checkOut محاسبه می‌کند و رکورد بدون یکی از آن‌ها را نادیده می‌گیرد", async () => {
      const prisma = buildPrisma();
      prisma.payrollWorkLog.findUnique.mockResolvedValue(null);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        {
          status: "present",
          checkInTime: new Date(2026, 2, 5, 8, 0),
          checkOutTime: new Date(2026, 2, 5, 16, 30),
        },
        { status: "present", checkInTime: null, checkOutTime: new Date(2026, 2, 6, 16, 0) },
      ]);
      const service = buildService(prisma);

      await service.aggregateForEmployee("period-1", "emp-1", START, END);

      expect(prisma.payrollWorkLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ workedHours: 8.5 }) }),
      );
    });

    it("رکورد جدید را با source='auto_aggregated' ایجاد می‌کند", async () => {
      const prisma = buildPrisma();
      prisma.payrollWorkLog.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);

      const wasManual = await service.aggregateForEmployee("period-1", "emp-1", START, END);

      expect(wasManual).toBe(false);
      expect(prisma.payrollWorkLog.upsert).toHaveBeenCalledWith({
        where: { payrollPeriodId_employeeId: { payrollPeriodId: "period-1", employeeId: "emp-1" } },
        create: expect.objectContaining({
          payrollPeriodId: "period-1",
          employeeId: "emp-1",
          source: "auto_aggregated",
        }),
        update: expect.objectContaining({ source: "auto_aggregated" }),
      });
    });

    it("رکورد auto_aggregated موجود را دوباره بازمحاسبه می‌کند (نه رد می‌شود)", async () => {
      const prisma = buildPrisma();
      prisma.payrollWorkLog.findUnique.mockResolvedValue({ source: "auto_aggregated" });
      const service = buildService(prisma);

      const wasManual = await service.aggregateForEmployee("period-1", "emp-1", START, END);

      expect(wasManual).toBe(false);
      expect(prisma.payrollWorkLog.upsert).toHaveBeenCalled();
    });
  });

  describe("setManualOverride", () => {
    it("رکورد را با source='manual' ذخیره می‌کند تا تجمیع خودکار دیگر رویش بازنویسی نکند", async () => {
      const prisma = buildPrisma();
      const service = buildService(prisma);

      await service.setManualOverride("period-1", "emp-1", { workedDays: 25, overtimeHours: 3 });

      expect(prisma.payrollWorkLog.upsert).toHaveBeenCalledWith({
        where: { payrollPeriodId_employeeId: { payrollPeriodId: "period-1", employeeId: "emp-1" } },
        create: { payrollPeriodId: "period-1", employeeId: "emp-1", workedDays: 25, overtimeHours: 3, source: "manual" },
        update: { workedDays: 25, overtimeHours: 3, source: "manual" },
      });
    });
  });
});
