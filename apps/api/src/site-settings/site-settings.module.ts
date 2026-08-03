import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { FilesModule } from "../files/files.module";
import { SiteSettingsController } from "./site-settings.controller";
import { PublicSiteSettingsController } from "./public-site-settings.controller";
import { SiteSettingsService } from "./site-settings.service";

@Module({
  imports: [PermissionsModule, FilesModule],
  controllers: [SiteSettingsController, PublicSiteSettingsController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
