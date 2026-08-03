import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** Repository Pattern — کاتالوگ اجزای حقوق (BASE/HOUSE/INSURANCE/TAX/...)، مستقل از هر نسخه‌ی قانون. */
@Injectable()
export class PayrollComponentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.payrollComponent.findUnique({ where: { id }, include: { formula: true } });
  }

  findByCode(code: string) {
    return this.prisma.payrollComponent.findUnique({ where: { code }, include: { formula: true } });
  }

  listActive() {
    return this.prisma.payrollComponent.findMany({
      where: { status: "active" },
      include: { formula: true },
      orderBy: { calcOrder: "asc" },
    });
  }

  create(data: {
    code: string;
    title: string;
    componentType: string;
    isInsurable?: boolean;
    isTaxable?: boolean;
    calcOrder?: number;
    formulaId?: string | null;
  }) {
    return this.prisma.payrollComponent.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      title: string;
      componentType: string;
      isInsurable: boolean;
      isTaxable: boolean;
      calcOrder: number;
      formulaId: string | null;
      status: string;
    }>,
  ) {
    return this.prisma.payrollComponent.update({ where: { id }, data });
  }
}
