import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [PermissionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // export می‌شه — ماژول‌های دیگه (Inquiries mention، Correspondence refer، Rfqs/Activities cron)
  // باید بتونن create() رو صدا بزنن
  exports: [NotificationsService],
})
export class NotificationsModule {}
