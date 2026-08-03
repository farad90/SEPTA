import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { CreateHrRequestDto } from "./dto/hr-request.dto";

const HR_REQUEST_INCLUDE = {
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.HrRequestInclude;

@Injectable()
export class HrRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
  ) {}

  async create(userId: string, dto: CreateHrRequestDto) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.hrRequest.create({
      data: { employeeId: employee.id, requestType: dto.requestType, description: dto.description },
      include: HR_REQUEST_INCLUDE,
    });
  }

  async mine(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.hrRequest.findMany({
      where: { employeeId: employee.id },
      include: HR_REQUEST_INCLUDE,
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
    // hr_requests.status مقدار 'cancelled' نداره (فقط pending/approved/rejected/completed)
    return this.prisma.hrRequest.update({
      where: { id },
      data: { status: "rejected" },
      include: HR_REQUEST_INCLUDE,
    });
  }

  async pendingApproval(userId: string) {
    const manager = await this.access.assertMyEmployee(userId);
    return this.prisma.hrRequest.findMany({
      where: { status: "pending", employee: { directManagerId: manager.id } },
      include: { ...HR_REQUEST_INCLUDE, employee: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async approve(userId: string, id: string) {
    const request = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, request.employeeId);
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.hrRequest.update({
      where: { id },
      data: { status: "approved", approverId: manager.id },
      include: HR_REQUEST_INCLUDE,
    });
  }

  async reject(userId: string, id: string) {
    const request = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, request.employeeId);
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.hrRequest.update({
      where: { id },
      data: { status: "rejected", approverId: manager.id },
      include: HR_REQUEST_INCLUDE,
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.hrRequest.findMany({
      where: { employeeId },
      include: HR_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOrThrow(id: string) {
    const request = await this.prisma.hrRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException("درخواست یافت نشد");
    }
    return request;
  }
}
