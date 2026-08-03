import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { OurEntitiesController } from "./our-entities.controller";
import { OurEntitiesService } from "./our-entities.service";

@Module({
  imports: [PermissionsModule],
  controllers: [OurEntitiesController],
  providers: [OurEntitiesService],
  exports: [OurEntitiesService],
})
export class OurEntitiesModule {}
