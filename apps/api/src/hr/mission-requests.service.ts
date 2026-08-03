import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { CreateMissionRequestDto } from "./dto/mission-request.dto";

const MISSION_REQUEST_INCLUDE = {
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.MissionRequestInclude;

@Injectable()
export class MissionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
  ) {}

  async create(userId: string, dto: CreateMissionRequestDto) {
    const employee = await this.access.assertMyEmployee(userId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException("تاریخ پایان نمی‌تونه قبل از تاریخ شروع باشه");
    }
    return this.prisma.missionRequest.create({
      data: {
        employeeId: employee.id,
        destination: dto.destination,
        purpose: dto.purpose,
        startDate,
        endDate,
        transportationMethod: dto.transportationMethod,
        estimatedCost: dto.estimatedCost,
        currencyCode: dto.currencyCode,
      },
      include: MISSION_REQUEST_INCLUDE,
    });
  }

  async mine(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.missionRequest.findMany({
      where: { employeeId: employee.id },
      include: MISSION_REQUEST_INCLUDE,
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
    // mission_requests.status هیچ مقدار 'cancelled' نداره (برخلاف leave_requests) —
    // طبق erp-schema.sql فقط pending/approved/rejected/completed مجازن، پس لغو خودسرویس
    // نزدیک‌ترین معادل معناییش 'rejected' است
    return this.prisma.missionRequest.update({
      where: { id },
      data: { status: "rejected" },
      include: MISSION_REQUEST_INCLUDE,
    });
  }

  async pendingApproval(userId: string) {
    const manager = await this.access.assertMyEmployee(userId);
    return this.prisma.missionRequest.findMany({
      where: { status: "pending", employee: { directManagerId: manager.id } },
      include: { ...MISSION_REQUEST_INCLUDE, employee: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approve(userId: string, id: string) {
    const request = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, request.employeeId);
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.missionRequest.update({
      where: { id },
      data: { status: "approved", approverId: manager.id, approvedAt: new Date() },
      include: MISSION_REQUEST_INCLUDE,
    });
  }

  async reject(userId: string, id: string) {
    const request = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, request.employeeId);
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.missionRequest.update({
      where: { id },
      data: { status: "rejected", approverId: manager.id, approvedAt: new Date() },
      include: MISSION_REQUEST_INCLUDE,
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.missionRequest.findMany({
      where: { employeeId },
      include: MISSION_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOrThrow(id: string) {
    const request = await this.prisma.missionRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException("درخواست مأموریت یافت نشد");
    }
    return request;
  }
}
