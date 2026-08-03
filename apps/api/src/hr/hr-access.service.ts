import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HrAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** پرونده پرسنلی متصل به کاربر جاری، یا null اگه وصل نیست */
  async getMyEmployee(userId: string) {
    return this.prisma.employee.findFirst({ where: { userId } });
  }

  /** مثل getMyEmployee ولی اگه پرونده‌ای وصل نبود خطا می‌ده — برای Endpoint های خودسرویس */
  async assertMyEmployee(userId: string) {
    const employee = await this.getMyEmployee(userId);
    if (!employee) {
      throw new ForbiddenException("پرونده پرسنلی متصل به این حساب کاربری وجود نداره");
    }
    return employee;
  }

  /** فقط سرپرست مستقیمِ خودِ پرسنل مجاز به تأیید/رده — نه گروه مدیریت، نه HR */
  async assertIsDirectManagerOf(managerUserId: string, targetEmployeeId: string) {
    const target = await this.prisma.employee.findUnique({ where: { id: targetEmployeeId } });
    if (!target) {
      throw new NotFoundException("پرسنل یافت نشد");
    }
    const manager = await this.getMyEmployee(managerUserId);
    if (!manager || target.directManagerId !== manager.id) {
      throw new ForbiddenException("فقط سرپرست مستقیم این پرسنل می‌تونه تأیید/رد کنه");
    }
    return { manager, target };
  }
}
