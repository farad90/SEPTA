import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PayrollPeriodNotFoundError } from "./errors";
import { periodDateRange } from "./period-date-range";
import { sumOverlapDays } from "./worklog-overlap";

const OVERTIME_COUNTED_STATUSES = ["approved", "paid"];
const LEAVE_COUNTED_STATUSES = ["approved"];
const MISSION_COUNTED_STATUSES = ["approved", "completed"];

/**
 * تجمیع خودکار PayrollWorkLog از جداول موجود منابع انسانی (تصمیم تأییدشده §00-ب) —
 * هیچ جدول ورودی دستی موازی ساخته نمی‌شود؛ فقط برای موارد استثنا، یک رکورد با source='manual'
 * از قبل ثبت شده باشد، این سرویس کاملاً از آن عبور می‌کند و دست‌نخورده باقی می‌ماند.
 */
@Injectable()
export class WorkLogAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateForPeriod(payrollPeriodId: string): Promise<{ processed: number; skippedManual: number }> {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: payrollPeriodId },
      include: { payrollYear: true },
    });
    if (!period) throw new PayrollPeriodNotFoundError(payrollPeriodId);

    const { start, end } = periodDateRange(
      period.payrollYear.calendarType,
      period.payrollYear.yearNumber,
      period.monthNumber,
    );

    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: "active", payrollProfile: { isNot: null } },
      select: { id: true },
    });

    let processed = 0;
    let skippedManual = 0;
    for (const { id: employeeId } of employees) {
      const wasManual = await this.aggregateForEmployee(payrollPeriodId, employeeId, start, end);
      if (wasManual) skippedManual++;
      else processed++;
    }

    return { processed, skippedManual };
  }

  /** @returns true اگر رکورد موجود دستی (`source='manual'`) بوده و دست‌نخورده رها شده است */
  async aggregateForEmployee(
    payrollPeriodId: string,
    employeeId: string,
    periodStart: Date,
    periodEndExclusive: Date,
  ): Promise<boolean> {
    const existing = await this.prisma.payrollWorkLog.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
    });
    if (existing?.source === "manual") return true;

    const [attendance, overtime, leaves, missions] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, workDate: { gte: periodStart, lt: periodEndExclusive } },
      }),
      this.prisma.overtimeRecord.findMany({
        where: {
          employeeId,
          workDate: { gte: periodStart, lt: periodEndExclusive },
          status: { in: OVERTIME_COUNTED_STATUSES },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: { in: LEAVE_COUNTED_STATUSES },
          startDate: { lt: periodEndExclusive },
          endDate: { gte: periodStart },
        },
      }),
      this.prisma.missionRequest.findMany({
        where: {
          employeeId,
          status: { in: MISSION_COUNTED_STATUSES },
          startDate: { lt: periodEndExclusive },
          endDate: { gte: periodStart },
        },
      }),
    ]);

    const workedDays = attendance.filter((a) => a.status === "present" || a.status === "mission").length;
    const absenceDays = attendance.filter((a) => a.status === "absent").length;
    const overtimeHours = overtime.reduce((sum, o) => sum + Number(o.hours), 0);
    const leaveDays = sumOverlapDays(leaves, periodStart, periodEndExclusive);
    const missionDays = sumOverlapDays(missions, periodStart, periodEndExclusive);
    const workedHours = attendance.reduce((sum, a) => {
      if (!a.checkInTime || !a.checkOutTime) return sum;
      const hours = (a.checkOutTime.getTime() - a.checkInTime.getTime()) / (60 * 60 * 1000);
      return sum + Math.max(0, hours);
    }, 0);

    const data = {
      workedDays,
      overtimeHours,
      leaveDays,
      absenceDays,
      missionDays,
      workedHours,
      source: "auto_aggregated",
    };

    await this.prisma.payrollWorkLog.upsert({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
      create: { payrollPeriodId, employeeId, ...data },
      update: data,
    });

    return false;
  }

  /**
   * اصلاح دستی یک ردیف WorkLog برای موارد استثنا (تصمیم تأییدشده §00-ب) — از این پس این ردیف
   * `source='manual'` می‌شود و aggregateForPeriod/aggregateForEmployee دیگر رویش بازنویسی نمی‌کنند،
   * مگر با یک اصلاح دستی دیگر.
   */
  setManualOverride(
    payrollPeriodId: string,
    employeeId: string,
    data: Partial<{
      workedDays: number;
      overtimeHours: number;
      nightHours: number;
      fridayHours: number;
      holidayHours: number;
      missionDays: number;
      leaveDays: number;
      absenceDays: number;
      latenessMinutes: number;
      earlyLeaveMinutes: number;
      requiredHours: number;
      workedHours: number;
    }>,
  ) {
    return this.prisma.payrollWorkLog.upsert({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
      create: { payrollPeriodId, employeeId, ...data, source: "manual" },
      update: { ...data, source: "manual" },
    });
  }
}
