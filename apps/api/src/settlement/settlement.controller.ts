import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { SettlementService } from "./settlement.service";
import { SaveCollectionDto, SaveInvoiceItemDto, UpdateDeliveryDto, UpsertInvoiceDto } from "./dto/settlement.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @RequirePermissions("settlement.record_delivery")
  @Get("inquiries/:id/delivery")
  getDelivery(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getDelivery(id);
  }

  @RequirePermissions("settlement.record_delivery")
  @Patch("inquiries/:id/delivery")
  updateDelivery(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateDelivery(id, dto, user.userId);
  }

  @RequirePermissions("settlement.issue_invoice")
  @Get("inquiries/:id/invoice")
  getInvoice(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getInvoice(id);
  }

  @RequirePermissions("settlement.issue_invoice")
  @Put("inquiries/:id/invoice")
  upsertInvoice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpsertInvoiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.upsertInvoice(id, dto, user.userId);
  }

  @RequirePermissions("settlement.issue_invoice")
  @Post("inquiries/:id/invoice/items")
  addInvoiceItem(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveInvoiceItemDto) {
    return this.service.addInvoiceItem(id, dto);
  }

  @RequirePermissions("settlement.issue_invoice")
  @Patch("invoice-items/:id")
  updateInvoiceItem(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveInvoiceItemDto) {
    return this.service.updateInvoiceItem(id, dto);
  }

  @RequirePermissions("settlement.issue_invoice")
  @Delete("invoice-items/:id")
  deleteInvoiceItem(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteInvoiceItem(id);
  }

  @RequirePermissions("settlement.record_collection")
  @Get("inquiries/:id/invoice/collections")
  listCollections(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listCollections(id);
  }

  @RequirePermissions("settlement.record_collection")
  @Post("inquiries/:id/invoice/collections")
  addCollection(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveCollectionDto) {
    return this.service.addCollection(id, dto);
  }

  @RequirePermissions("settlement.record_collection")
  @Patch("invoice-collections/:id")
  updateCollection(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveCollectionDto) {
    return this.service.updateCollection(id, dto);
  }

  @RequirePermissions("settlement.record_collection")
  @Delete("invoice-collections/:id")
  deleteCollection(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteCollection(id);
  }
}
