import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmployeePayrollProfileRepository } from "../repositories/employee-payroll-profile.repository";
import { UpsertPayrollProfileDto } from "../dto/payroll-profile.dto";

@Injectable()
export class PayrollProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileRepository: EmployeePayrollProfileRepository,
  ) {}

  async getByEmployeeId(employeeId: string) {
    const profile = await this.profileRepository.findByEmployeeId(employeeId);
    return profile; // null یعنی هنوز پروفایل حقوقی برای این پرسنل تعریف نشده — این خودش یک پاسخ معتبره
  }

  async upsert(employeeId: string, dto: UpsertPayrollProfileDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException("پرسنل یافت نشد");

    return this.profileRepository.upsert(employeeId, {
      seniorityBaseDate: dto.seniorityBaseDate ? new Date(dto.seniorityBaseDate) : undefined,
      insuranceNumber: dto.insuranceNumber,
      costCenterDeptId: dto.costCenterDeptId,
      defaultRuleVersionId: dto.defaultRuleVersionId,
    });
  }
}
