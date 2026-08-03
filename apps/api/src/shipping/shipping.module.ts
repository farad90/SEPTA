import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { ShippingController } from "./shipping.controller";
import { ShippingService } from "./shipping.service";

@Module({
  imports: [PermissionsModule],
  controllers: [ShippingController],
  providers: [ShippingService],
})
export class ShippingModule {}
