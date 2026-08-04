import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { UsersModule } from "./users/users.module";
import { PermissionGroupsModule } from "./permission-groups/permission-groups.module";
import { BusinessPartnersModule } from "./business-partners/business-partners.module";
import { ItemCatalogModule } from "./item-catalog/item-catalog.module";
import { ScheduleModule } from "@nestjs/schedule";
import { FilesModule } from "./files/files.module";
import { InquiriesModule } from "./inquiries/inquiries.module";
import { MailModule } from "./mail/mail.module";
import { RfqsModule } from "./rfqs/rfqs.module";
import { SelectionModule } from "./selection/selection.module";
import { ProposalModule } from "./proposal/proposal.module";
import { OutcomeModule } from "./outcome/outcome.module";
import { OrderModule } from "./order/order.module";
import { PoModule } from "./po/po.module";
import { ShippingModule } from "./shipping/shipping.module";
import { ShipmentsModule } from "./shipments/shipments.module";
import { FreightModule } from "./freight/freight.module";
import { SettlementModule } from "./settlement/settlement.module";
import { CorrespondenceModule } from "./correspondence/correspondence.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ChatModule } from "./chat/chat.module";
import { ActivitiesModule } from "./activities/activities.module";
import { HrModule } from "./hr/hr.module";
import { ActionCenterModule } from "./action-center/action-center.module";
import { OurEntitiesModule } from "./our-entities/our-entities.module";
import { ProposalDocumentsModule } from "./proposal-documents/proposal-documents.module";
import { PayrollModule } from "./payroll/payroll.module";
import { ReportsModule } from "./reports/reports.module";
import { SiteSettingsModule } from "./site-settings/site-settings.module";
import { BroadcastMessagesModule } from "./broadcast-messages/broadcast-messages.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./common/logging/logging.module";

@Module({
  imports: [
    LoggingModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    PermissionsModule,
    AuthModule,
    UsersModule,
    PermissionGroupsModule,
    BusinessPartnersModule,
    ItemCatalogModule,
    FilesModule,
    InquiriesModule,
    MailModule,
    RfqsModule,
    SelectionModule,
    ProposalModule,
    OutcomeModule,
    OrderModule,
    PoModule,
    ShippingModule,
    ShipmentsModule,
    FreightModule,
    SettlementModule,
    CorrespondenceModule,
    NotificationsModule,
    ChatModule,
    ActivitiesModule,
    HrModule,
    ActionCenterModule,
    OurEntitiesModule,
    ProposalDocumentsModule,
    PayrollModule,
    ReportsModule,
    SiteSettingsModule,
    BroadcastMessagesModule,
  ],
})
export class AppModule {}
