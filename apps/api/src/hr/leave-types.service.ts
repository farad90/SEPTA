import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from "./dto/leave-type.dto";

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.leaveType.findMany({ orderBy: { typeName: "asc" } });
  }

  async create(dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({ data: dto });
  }

  async update(id: string, dto: UpdateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("نوع مرخصی یافت نشد");
    }
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }
}
