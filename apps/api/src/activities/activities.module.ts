import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { ActivitiesScheduler } from "./activities.scheduler";
import { OutcomeTemplatesController } from "./outcome-templates.controller";
import { OutcomeTemplatesService } from "./outcome-templates.service";

@Module({
  imports: [PermissionsModule, NotificationsModule, InquiriesModule],
  controllers: [ActivitiesController, OutcomeTemplatesController],
  providers: [ActivitiesService, ActivitiesScheduler, OutcomeTemplatesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
