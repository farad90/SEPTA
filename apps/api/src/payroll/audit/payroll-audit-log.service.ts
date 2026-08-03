import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface PayrollAuditEntry {
  entityType: string;
  entityId: string;
  action: "created" | "updated" | "deleted" | "status_changed";
  performedBy: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

/** ثبت هر تغییر روی موجودیت‌های حقوق (چه کسی/کِی/چه چیزی) — مستقل از هر منطق محاسباتی. */
@Injectable()
export class PayrollAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: PayrollAuditEntry): Promise<void> {
    await this.prisma.payrollAuditLog.create({ data: entry });
  }

  listForEntity(entityType: string, entityId: string) {
    return this.prisma.payrollAuditLog.findMany({
      where: { entityType, entityId },
      orderBy: { performedAt: "desc" },
    });
  }
}
