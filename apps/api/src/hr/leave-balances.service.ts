import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SetLeaveBalanceDto } from "./dto/leave-balance.dto";

@Injectable()
export class LeaveBalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEmployee(employeeId: string, year?: number) {
    return this.prisma.leaveBalance.findMany({
      where: { employeeId, ...(year ? { year } : {}) },
      include: { leaveType: true },
      orderBy: [{ year: "desc" }, { leaveType: { typeName: "asc" } }],
    });
  }

  /** تعیین/ویرایش سقف سالانه — upsert روی (employeeId, leaveTypeId, year) */
  async set(employeeId: string, dto: SetLeaveBalanceDto) {
    return this.prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
        },
      },
      create: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        entitledDays: dto.entitledDays,
      },
      update: { entitledDays: dto.entitledDays },
      include: { leaveType: true },
    });
  }

  /** برای تأیید یک leave_request فراخوانی می‌شه — اگه سقفی تعریف نشده باشه خطا می‌ده */
  async incrementUsedDays(employeeId: string, leaveTypeId: string, year: number, days: number) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });
    if (!balance) {
      throw new NotFoundException("سقف مرخصی این نوع برای این پرسنل تعریف نشده — به HR اطلاع بده");
    }
    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { usedDays: { increment: days } },
    });
  }
}
