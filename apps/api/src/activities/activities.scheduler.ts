import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

/** Cron هر ۱۵ دقیقه — فعالیت‌های سررسیدشدهٔ باز رو Overdue می‌کنه + اعلان می‌ده (جایگزین RemindersScheduler سابق) */
@Injectable()
export class ActivitiesScheduler {
  private readonly logger = new Logger(ActivitiesScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("*/15 * * * *")
  async handleOverdueActivities() {
    const due = await this.prisma.activity.findMany({
      where: { status: { in: ["open", "scheduled", "waiting"] }, dueAt: { lte: new Date() } },
    });

    let overdueCount = 0;
    for (const activity of due) {
      await this.prisma.activity.update({
        where: { id: activity.id },
        data: { status: "overdue", updatedAt: new Date() },
      });

      const alreadyNotified = await this.notifications.existsForEntity(
        "activity",
        activity.id,
        "activity_overdue",
      );
      if (!alreadyNotified) {
        await this.notifications.create({
          userId: activity.assignedToUserId,
          type: "activity_overdue",
          title: `فعالیت سررسیدشده: ${activity.subject}`,
          relatedEntityType: "activity",
          relatedEntityId: activity.id,
        });
      }
      overdueCount++;
    }

    if (overdueCount > 0) {
      this.logger.log(`${overdueCount} فعالیت به «سررسیدگذشته» تغییر کرد`);
    }
  }
}
