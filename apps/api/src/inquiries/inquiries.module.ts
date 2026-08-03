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
  // طبق design doc باید اقدامات مهم‌شون رو در فید همین پرونده ثبت کنن
  exports: [ActivityLogService],
})
export class InquiriesModule {}
