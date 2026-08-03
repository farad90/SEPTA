import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import {
  ItemCatalogController,
  ItemCatalogDocumentsController,
} from "./item-catalog.controller";
import { ItemCatalogService } from "./item-catalog.service";

@Module({
  imports: [PermissionsModule],
  controllers: [ItemCatalogController, ItemCatalogDocumentsController],
  providers: [ItemCatalogService],
})
export class ItemCatalogModule {}
