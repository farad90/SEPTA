import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InquiriesService } from "./inquiries.service";

/**
 * Cron روزانه ۰۸:۰۰ — یادآوری تکرارشونده: تا وقتی برای یک استعلامِ در جریان هیچ RFQ
 * تأمین‌کننده‌ای ثبت نشده، هر روز اعلان قبلی پاک و نسخهٔ تازه به کاربران دارای دسترسی
 * rfq.view صادر می‌شه (بازخورد کاربر).
 */
@Injectable()
export class InquiriesScheduler {
  private readonly logger = new Logger(InquiriesScheduler.name);

  constructor(private readonly inquiriesService: InquiriesService) {}

  @Cron("0 8 * * *")
  async handlePendingSupplierRfqReminders() {
    const count = await this.inquiriesService.remindPendingSupplierRfqs();
    if (count > 0) {
      this.logger.log(`${count} استعلام هنوز بدون RFQ تأمین‌کننده — یادآوری روزانه صادر شد`);
    }
  }
}
