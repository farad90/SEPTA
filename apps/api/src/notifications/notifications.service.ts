import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** دکمهٔ قابل‌اقدام داخل اعلان — فرانت بر اساس relatedEntityType + action به endpoint مربوطه نگاشت می‌کنه */
export interface NotificationAction {
  label: string;
  action: string;
}

/**
 * سرویس Cross-Cutting اعلان‌ها (دامنه ۹، مثل ActivityLogService دامنه ۲):
 * از ماژول‌های دیگه (گفتگوی پرونده، ارجاع نامه، Cron های RFQ/Activities) صدا زده می‌شه.
 * از فاز ۲۷، actions (دکمه‌های تأیید/رد داخل اعلان طبق طراحی دامنه ۹) هم پشتیبانی می‌شه —
 * اولین استفاده: درخواست اصلاح مرحلهٔ قفل‌شدهٔ محموله (shipment_edit_request).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    userId: string;
    type: string;
    title: string;
    message?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    actions?: NotificationAction[];
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
        actions: params.actions ? JSON.parse(JSON.stringify(params.actions)) : undefined,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { success: result.count > 0 };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async recordAction(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isActioned: true, actionedAt: new Date() },
    });
    return { success: result.count > 0 };
  }

  /** آیا برای این موجودیت مشخص قبلاً اعلان صادر شده؟ (جلوگیری از تکرار activity_overdue در چند اجرای Cron) */
  async existsForEntity(relatedEntityType: string, relatedEntityId: string, type: string) {
    const found = await this.prisma.notification.findFirst({
      where: { relatedEntityType, relatedEntityId, type },
      select: { id: true },
    });
    return !!found;
  }

  /**
   * حذف اعلان(های) قبلی یک موجودیت/نوع مشخص — برای اعلان‌های «تکرارشونده روزانه تا رفع شرط»
   * (مثلاً یادآوری استعلام بدون RFQ تأمین‌کننده): هر بار قبل از صدور نسخه تازه، نسخه قبلی
   * (برای همه گیرنده‌ها) پاک می‌شه؛ و وقتی شرط رفع شد (RFQ ثبت شد)، بلافاصله پاک می‌شه.
   */
  async clearForEntity(relatedEntityType: string, relatedEntityId: string, type: string) {
    await this.prisma.notification.deleteMany({ where: { relatedEntityType, relatedEntityId, type } });
  }
}
