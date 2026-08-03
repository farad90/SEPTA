import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertAttendanceDto } from "./dto/attendance.dto";

function toDateOnly(d: Date | string): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEmployee(employeeId: string, month?: number, year?: number) {
    const where: { employeeId: string; workDate?: { gte: Date; lt: Date } } = { employeeId };
    if (month && year) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      where.workDate = { gte: start, lt: end };
    }
    return this.prisma.attendanceRecord.findMany({ where, orderBy: { workDate: "asc" } });
  }

  /** ثبت/ویرایش دستی یک روز توسط HR — همیشه source='manual' */
  async upsertManual(employeeId: string, dto: UpsertAttendanceDto) {
    const workDate = toDateOnly(dto.workDate);
    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      create: { employeeId, workDate, status: dto.status, notes: dto.notes, source: "manual" },
      update: { status: dto.status, notes: dto.notes, source: "manual" },
    });
  }

  /**
   * وقتی یک leave_request تأیید می‌شه، به‌ازای هر روز بازه، رکورد حضور روی
   * status='on_leave' بازنویسی می‌شه — مرخصی تأییدشده مرجع نهاییه (تصمیم ۴ SPEC-PHASE-19)
   */
  async syncApprovedLeave(employeeId: string, startDate: Date | string, endDate: Date | string) {
    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      days.push(new Date(d));
    }
    await Promise.all(
      days.map((workDate) =>
        this.prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId, workDate } },
          create: { employeeId, workDate, status: "on_leave", source: "manual" },
          update: { status: "on_leave", source: "manual" },
        }),
      ),
    );
  }
}
