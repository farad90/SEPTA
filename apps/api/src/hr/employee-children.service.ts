import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeChildDto } from "./dto/employee-child.dto";

@Injectable()
export class EmployeeChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  listForEmployee(employeeId: string) {
    return this.prisma.employeeChild.findMany({
      where: { employeeId },
      orderBy: { birthDate: "desc" },
    });
  }

  create(employeeId: string, dto: CreateEmployeeChildDto) {
    return this.prisma.employeeChild.create({
      data: { employeeId, fullName: dto.fullName, birthDate: new Date(dto.birthDate) },
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.employeeChild.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("رکورد فرزند یافت نشد");
    await this.prisma.employeeChild.delete({ where: { id } });
  }
}
