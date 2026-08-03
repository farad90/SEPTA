import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { SelectionModule } from "../selection/selection.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProposalController, ProposalPriceChangeRequestsController } from "./proposal.controller";
import { ProposalService } from "./proposal.service";
import { ProposalNumberService } from "./proposal-number.service";

@Module({
  imports: [PermissionsModule, InquiriesModule, SelectionModule, NotificationsModule],
  controllers: [ProposalController, ProposalPriceChangeRequestsController],
  providers: [ProposalService, ProposalNumberService],
  exports: [ProposalService],
})
export class ProposalModule {}
