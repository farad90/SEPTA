import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class EmployeePayrollProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmployeeId(employeeId: string) {
    return this.prisma.employeePayrollProfile.findUnique({ where: { employeeId } });
  }

  upsert(
    employeeId: string,
    data: {
      seniorityBaseDate?: Date | null;
      childrenCount?: number;
      insuranceNumber?: string | null;
      costCenterDeptId?: string | null;
      defaultRuleVersionId?: string | null;
    },
  ) {
    return this.prisma.employeePayrollProfile.upsert({
      where: { employeeId },
      create: { employeeId, ...data },
      update: data,
    });
  }
}
