import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InquiriesController } from "./inquiries.controller";
import { InquiriesService } from "./inquiries.service";
import { InquiryNumberService } from "./inquiry-number.service";
import { ActivityLogService } from "./activity-log.service";
import { InquiriesScheduler } from "./inquiries.scheduler";

@Module({
  imports: [PermissionsModule, NotificationsModule],
  controllers: [InquiriesController],
  providers: [InquiriesService, InquiryNumberService, ActivityLogService, InquiriesScheduler],
  // ActivityLogService عمداً export می‌شه — ماژول‌های فازهای بعد (RFQ، انتخاب، پیشنهاد و...)
  // طبق design doc باید اقدامات مهم‌شون رو در فید همین پرونده ثبت کنن. InquiriesService از
  // فاز ۵۸ export شد تا Rfqs/Settlement بتونن autoAssignProcurementOwner/autoAssignFinanceOwner
  // رو صدا بزنن (نگاه کنید به erp-database-design.md دامنه ۱۴) — بدون Circular Dependency،
  // چون InquiriesModule خودش چیزی از این ماژول‌ها import نمی‌کنه.
  exports: [ActivityLogService, InquiriesService],
})
export class InquiriesModule {}
