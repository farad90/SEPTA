import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { BusinessPartnersController } from "./business-partners.controller";
import { BusinessPartnersService } from "./business-partners.service";

@Module({
  imports: [PermissionsModule],
  controllers: [BusinessPartnersController],
  providers: [BusinessPartnersService],
})
export class BusinessPartnersModule {}
