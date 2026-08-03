import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeDeductionDto, UpdateEmployeeDeductionDto } from "./dto/employee-deduction.dto";

@Injectable()
export class EmployeeDeductionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEmployee(employeeId: string) {
    return this.prisma.employeeDeduction.findMany({
      where: { employeeId },
      include: { deductionType: true },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async create(employeeId: string, dto: CreateEmployeeDeductionDto) {
    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.employeeDeduction.create({
      data: {
        ...rest,
        employeeId,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      },
      include: { deductionType: true },
    });
  }

  async update(id: string, dto: UpdateEmployeeDeductionDto) {
    const existing = await this.prisma.employeeDeduction.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("تخصیص کسر یافت نشد");
    }
    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.employeeDeduction.update({
      where: { id },
      data: {
        ...rest,
        ...(effectiveFrom !== undefined ? { effectiveFrom: new Date(effectiveFrom) } : {}),
        ...(effectiveTo !== undefined ? { effectiveTo: new Date(effectiveTo) } : {}),
      },
      include: { deductionType: true },
    });
  }
}
