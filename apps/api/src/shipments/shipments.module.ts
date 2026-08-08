import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ActivitiesModule } from "../activities/activities.module";
import {
  ShipmentDocumentsController,
  ShipmentEditRequestsController,
  ShipmentsController,
} from "./shipments.controller";
import { ShipmentsService } from "./shipments.service";
import { ShipmentNumberService } from "./shipment-number.service";

@Module({
  imports: [PermissionsModule, InquiriesModule, NotificationsModule, ActivitiesModule],
  controllers: [ShipmentsController, ShipmentDocumentsController, ShipmentEditRequestsController],
  providers: [ShipmentsService, ShipmentNumberService],
  exports: [ShipmentNumberService],
})
export class ShipmentsModule {}
