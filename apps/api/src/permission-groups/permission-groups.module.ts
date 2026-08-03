import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { PermissionGroupsController } from "./permission-groups.controller";
import { PermissionGroupsService } from "./permission-groups.service";

@Module({
  imports: [PermissionsModule],
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService],
})
export class PermissionGroupsModule {}
