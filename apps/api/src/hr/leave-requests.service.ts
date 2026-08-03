import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { LeaveBalancesService } from "./leave-balances.service";
import { AttendanceService } from "./attendance.service";
import { CreateLeaveRequestDto } from "./dto/leave-request.dto";

const LEAVE_REQUEST_INCLUDE = {
  leaveType: true,
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

function toDateOnly(d: string): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calcDaysCount(start: Date, end: Date): number {
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
    private readonly balances: LeaveBalancesService,
    private readonly attendance: AttendanceService,
  ) {}

  async create(userId: string, dto: CreateLeaveRequestDto) {
    const employee = await this.access.assertMyEmployee(userId);
    const startDate = toDateOnly(dto.startDate);
    const endDate = toDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException("تاریخ پایان نمی‌تونه قبل از تاریخ شروع باشه");
    }
    const daysCount = calcDaysCount(startDate, endDate);
    const year = startDate.getUTCFullYear();

    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: dto.leaveTypeId, year } },
    });
    if (!balance) {
      throw new BadRequestException("سقف مرخصی این نوع برای شما تعریف نشده — به HR اطلاع بده");
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        daysCount,
        reason: dto.reason,
        attachmentFileUrl: dto.attachmentFileUrl,
      },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async mine(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      include: LEAVE_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async cancel(userId: string, id: string) {
    const employee = await this.access.assertMyEmployee(userId);
    const request = await this.getOrThrow(id);
    if (request.employeeId !== employee.id) {
      throw new BadRequestException("فقط ثبت‌کننده می‌تونه درخواست خودش رو لغو کنه");
    }
    if (request.status !== "pending") {
      throw new BadRequestException("فقط درخواست در انتظار تأیید قابل لغوه");
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "cancelled" },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async pendingApproval(userId: string) {
    const manager = await this.access.assertMyEmployee(userId);
    return this.prisma.leaveRequest.findMany({
      where: { status: "pending", employee: { directManagerId: manager.id } },
      include: { ...LEAVE_REQUEST_INCLUDE, employee: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approve(userId: string, id: string) {
    const request = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, request.employeeId);
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    const year = request.startDate.getUTCFullYear();
    await this.balances.incrementUsedDays(request.employeeId, request.leaveTypeId, year, Number(request.daysCount));
    await this.attendance.syncApprovedLeave(request.employeeId, request.startDate, request.endDate);
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "approved", approverId: manager.id, approvedAt: new Date() },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async reject(userId: string, id: string) {
    const request = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, request.employeeId);
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "rejected", approverId: manager.id, approvedAt: new Date() },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { employeeId },
      include: LEAVE_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOrThrow(id: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException("درخواست مرخصی یافت نشد");
    }
    return request;
  }
}
