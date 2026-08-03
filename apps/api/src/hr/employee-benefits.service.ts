import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeBenefitDto, UpdateEmployeeBenefitDto } from "./dto/employee-benefit.dto";

@Injectable()
export class EmployeeBenefitsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEmployee(employeeId: string) {
    return this.prisma.employeeBenefit.findMany({
      where: { employeeId },
      include: { benefitType: true },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  async create(employeeId: string, dto: CreateEmployeeBenefitDto) {
    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.employeeBenefit.create({
      data: {
        ...rest,
        employeeId,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      },
      include: { benefitType: true },
    });
  }

  async update(id: string, dto: UpdateEmployeeBenefitDto) {
    const existing = await this.prisma.employeeBenefit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("تخصیص مزایا یافت نشد");
    }
    const { effectiveFrom, effectiveTo, ...rest } = dto;
    return this.prisma.employeeBenefit.update({
      where: { id },
      data: {
        ...rest,
        ...(effectiveFrom !== undefined ? { effectiveFrom: new Date(effectiveFrom) } : {}),
        ...(effectiveTo !== undefined ? { effectiveTo: new Date(effectiveTo) } : {}),
      },
      include: { benefitType: true },
    });
  }
}
