import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ActivitiesModule } from "../activities/activities.module";
import { RfqDeleteRequestsController, RfqsController } from "./rfqs.controller";
import { RfqsService } from "./rfqs.service";
import { RfqNumberService } from "./rfq-number.service";
import { RfqsScheduler } from "./rfqs.scheduler";

@Module({
  imports: [PermissionsModule, InquiriesModule, MailModule, NotificationsModule, ActivitiesModule],
  controllers: [RfqsController, RfqDeleteRequestsController],
  providers: [RfqsService, RfqNumberService, RfqsScheduler],
})
export class RfqsModule {}
