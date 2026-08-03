import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CorrespondenceController } from "./correspondence.controller";
import { CorrespondenceService } from "./correspondence.service";
import { LetterNumberService } from "./letter-number.service";

@Module({
  imports: [PermissionsModule, NotificationsModule],
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService, LetterNumberService],
})
export class CorrespondenceModule {}
