import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { FilesController } from "./files.controller";
import { StorageService } from "./storage.service";
import { FileAccessService } from "./file-access.service";

@Module({
  imports: [PermissionsModule],
  controllers: [FilesController],
  providers: [StorageService, FileAccessService],
  exports: [StorageService],
})
export class FilesModule {}
