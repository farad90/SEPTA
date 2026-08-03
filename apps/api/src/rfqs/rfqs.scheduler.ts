import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RfqsService } from "./rfqs.service";

/** Job شبانه ۰۲:۰۰ — RFQ های منقضی‌شده رو خودکار «بدون پاسخ» می‌کنه */
@Injectable()
export class RfqsScheduler {
  private readonly logger = new Logger(RfqsScheduler.name);

  constructor(private readonly rfqsService: RfqsService) {}

  @Cron("0 2 * * *")
  async handleOverdueRfqs() {
    const count = await this.rfqsService.markOverdueAsNoResponse();
    if (count > 0) {
      this.logger.log(`${count} RFQ منقضی‌شده به «بدون پاسخ» تغییر کرد`);
    }
  }
}
