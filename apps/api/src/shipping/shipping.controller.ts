import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ShippingService } from "./shipping.service";
import {
  AddProductionLogDto,
  AddWarehouseReceiptPhotoDto,
  SavePackageDto,
  SaveWarehouseReceiptItemsDto,
  UpdateProductionTrackingDto,
} from "./dto/shipping.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ShippingController {
  constructor(private readonly service: ShippingService) {}

  @RequirePermissions("shipping.view")
  @Get("inquiries/:id/production-tracking")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getProductionTracking(id);
  }

  @RequirePermissions("shipping.record_packaging")
  @Patch("inquiries/:id/production-tracking/:poId")
  updateTracking(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("poId", ParseUUIDPipe) poId: string,
    @Body() dto: UpdateProductionTrackingDto,
  ) {
    return this.service.updateTracking(id, poId, dto);
  }

  @RequirePermissions("shipping.record_packaging")
  @Post("inquiries/:id/production-tracking/:poId/logs")
  addLog(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("poId", ParseUUIDPipe) poId: string,
    @Body() dto: AddProductionLogDto,
  ) {
    return this.service.addLog(id, poId, dto);
  }

  @RequirePermissions("shipping.record_packaging")
  @Post("inquiries/:id/production-tracking/:poId/packages")
  addPackage(@Param("id", ParseUUIDPipe) id: string, @Param("poId", ParseUUIDPipe) poId: string) {
    return this.service.addPackage(id, poId);
  }

  @RequirePermissions("shipping.record_packaging")
  @Patch("packages/:id")
  updatePackage(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SavePackageDto) {
    return this.service.updatePackage(id, dto);
  }

  @RequirePermissions("shipping.record_packaging")
  @Delete("packages/:id")
  deletePackage(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deletePackage(id);
  }

  @RequirePermissions("shipping.view")
  @Get("inquiries/:id/shipment-status")
  getShipmentStatus(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getShipmentStatus(id);
  }

  @RequirePermissions("shipping.record_warehouse_receipt")
  @Get("inquiries/:id/warehouse-receipt")
  getWarehouseReceipt(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getWarehouseReceipt(id);
  }

  @RequirePermissions("shipping.record_warehouse_receipt")
  @Put("inquiries/:id/warehouse-receipt/items")
  saveWarehouseReceiptItems(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveWarehouseReceiptItemsDto) {
    return this.service.saveWarehouseReceiptItems(id, dto);
  }

  @RequirePermissions("shipping.record_warehouse_receipt")
  @Post("warehouse-receipt-items/:id/photos")
  addWarehouseReceiptPhoto(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddWarehouseReceiptPhotoDto) {
    return this.service.addWarehouseReceiptPhoto(id, dto);
  }
}
