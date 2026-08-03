import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { SettlementController } from "./settlement.controller";
import { SettlementService } from "./settlement.service";

@Module({
  imports: [PermissionsModule],
  controllers: [SettlementController],
  providers: [SettlementService],
})
export class SettlementModule {}
