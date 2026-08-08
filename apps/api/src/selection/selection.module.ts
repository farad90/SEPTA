import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { ActivitiesModule } from "../activities/activities.module";
import { SelectionController } from "./selection.controller";
import { SelectionService } from "./selection.service";

@Module({
  imports: [PermissionsModule, InquiriesModule, ActivitiesModule],
  controllers: [SelectionController],
  providers: [SelectionService],
  // فاز ۶ (پیشنهاد به مشتری) baseline قیمت‌گذاری/فی مؤثر رو از همین سرویس می‌خونه
  exports: [SelectionService],
})
export class SelectionModule {}
