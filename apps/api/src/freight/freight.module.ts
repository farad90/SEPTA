import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { MailModule } from "../mail/mail.module";
import { ShipmentsModule } from "../shipments/shipments.module";
import { FreightController } from "./freight.controller";
import { FreightService } from "./freight.service";
import { FreightRfqNumberService } from "./freight-rfq-number.service";

@Module({
  imports: [PermissionsModule, InquiriesModule, MailModule, ShipmentsModule],
  controllers: [FreightController],
  providers: [FreightService, FreightRfqNumberService],
})
export class FreightModule {}
