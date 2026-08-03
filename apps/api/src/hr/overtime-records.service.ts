import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { CreateOvertimeRecordDto } from "./dto/overtime-record.dto";

const OVERTIME_INCLUDE = {
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.OvertimeRecordInclude;

@Injectable()
export class OvertimeRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
  ) {}

  async create(userId: string, dto: CreateOvertimeRecordDto) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.overtimeRecord.create({
      data: {
        employeeId: employee.id,
        workDate: new Date(dto.workDate),
        hours: dto.hours,
        reason: dto.reason,
        rateMultiplier: dto.rateMultiplier ?? 1.4,
        calculatedAmount: dto.calculatedAmount,
        currencyCode: dto.currencyCode,
      },
      include: OVERTIME_INCLUDE,
    });
  }

  async mine(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.overtimeRecord.findMany({
      where: { employeeId: employee.id },
      include: OVERTIME_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async cancel(userId: string, id: string) {
    const employee = await this.access.assertMyEmployee(userId);
    const record = await this.getOrThrow(id);
    if (record.employeeId !== employee.id) {
      throw new BadRequestException("فقط ثبت‌کننده می‌تونه درخواست خودش رو لغو کنه");
    }
    if (record.status !== "pending") {
      throw new BadRequestException("فقط درخواست در انتظار تأیید قابل لغوه");
    }
    // overtime_records.status هم مثل mission_requests مقدار 'cancelled' نداره
    return this.prisma.overtimeRecord.update({
      where: { id },
      data: { status: "rejected" },
      include: OVERTIME_INCLUDE,
    });
  }

  async pendingApproval(userId: string) {
    const manager = await this.access.assertMyEmployee(userId);
    return this.prisma.overtimeRecord.findMany({
      where: { status: "pending", employee: { directManagerId: manager.id } },
      include: { ...OVERTIME_INCLUDE, employee: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approve(userId: string, id: string) {
    const record = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, record.employeeId);
    if (record.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.overtimeRecord.update({
      where: { id },
      data: { status: "approved", approverId: manager.id },
      include: OVERTIME_INCLUDE,
    });
  }

  async reject(userId: string, id: string) {
    const record = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, record.employeeId);
    if (record.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.overtimeRecord.update({
      where: { id },
      data: { status: "rejected", approverId: manager.id },
      include: OVERTIME_INCLUDE,
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.overtimeRecord.findMany({
      where: { employeeId },
      include: OVERTIME_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOrThrow(id: string) {
    const record = await this.prisma.overtimeRecord.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException("درخواست اضافه‌کاری یافت نشد");
    }
    return record;
  }
}
