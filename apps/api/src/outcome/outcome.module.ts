import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { OutcomeController } from "./outcome.controller";
import { OutcomeService } from "./outcome.service";

@Module({
  imports: [PermissionsModule, InquiriesModule],
  controllers: [OutcomeController],
  providers: [OutcomeService],
})
export class OutcomeModule {}
