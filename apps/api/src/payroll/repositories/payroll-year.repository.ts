import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PayrollYearRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.payrollYear.findUnique({ where: { id } });
  }

  findByYearNumber(yearNumber: number) {
    return this.prisma.payrollYear.findUnique({ where: { yearNumber } });
  }

  list() {
    return this.prisma.payrollYear.findMany({ orderBy: { yearNumber: "desc" } });
  }

  create(data: { yearNumber: number; calendarType: string }) {
    return this.prisma.payrollYear.create({ data });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.payrollYear.update({ where: { id }, data: { status } });
  }
}
