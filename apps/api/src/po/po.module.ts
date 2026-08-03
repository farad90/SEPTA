import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { SelectionModule } from "../selection/selection.module";
import { PoController } from "./po.controller";
import { PoService } from "./po.service";

@Module({
  imports: [PermissionsModule, InquiriesModule, SelectionModule],
  controllers: [PoController],
  providers: [PoService],
})
export class PoModule {}
