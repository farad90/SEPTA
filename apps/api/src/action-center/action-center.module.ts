import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { ActivitiesModule } from "../activities/activities.module";
import { HrModule } from "../hr/hr.module";
import { ActionCenterController } from "./action-center.controller";
import { ActionCenterService } from "./action-center.service";
import { ACTION_RULE_PROVIDERS, ActionRuleProvider } from "./action-item.types";
import { ActivityRuleProvider } from "./providers/activity-rule.provider";
import { HrApprovalRuleProvider } from "./providers/hr-approval-rule.provider";
import { ShipmentEditRuleProvider } from "./providers/shipment-edit-rule.provider";
import { LetterReferralRuleProvider } from "./providers/letter-referral-rule.provider";

@Module({
  imports: [PermissionsModule, ActivitiesModule, HrModule],
  controllers: [ActionCenterController],
  providers: [
    ActionCenterService,
    ActivityRuleProvider,
    HrApprovalRuleProvider,
    ShipmentEditRuleProvider,
    LetterReferralRuleProvider,
    {
      // رجیستری منابع — افزودن منبع جدید یعنی این‌جا یک ورودی اضافه بشه، بدون
      // نیاز به تغییر ActionCenterService
      provide: ACTION_RULE_PROVIDERS,
      useFactory: (
        activity: ActivityRuleProvider,
        hr: HrApprovalRuleProvider,
        shipmentEdit: ShipmentEditRuleProvider,
        letterReferral: LetterReferralRuleProvider,
      ): ActionRuleProvider[] => [activity, hr, shipmentEdit, letterReferral],
      inject: [ActivityRuleProvider, HrApprovalRuleProvider, ShipmentEditRuleProvider, LetterReferralRuleProvider],
    },
  ],
})
export class ActionCenterModule {}
