import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ShipmentsService } from "./shipments.service";
import {
  AddShipmentDocumentDto,
  CreateEditRequestDto,
  UpdateExportDocumentsDto,
  UpdateImportDocumentsDto,
  UpdateShipmentDto,
} from "./dto/shipment.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("shipping.manage_shipment")
@Controller("shipments")
export class ShipmentsController {
  constructor(private readonly service: ShipmentsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Patch(":id/export-documents")
  updateExportDocuments(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateExportDocumentsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateExportDocuments(id, dto, user.userId);
  }

  @Post(":id/export-documents/mark-sent")
  markExportDocumentsSent(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.markExportDocumentsSent(id, user.userId);
  }

  @Patch(":id/import-documents")
  updateImportDocuments(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateImportDocumentsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateImportDocuments(id, dto, user.userId);
  }

  @Post(":id/advance")
  advance(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.advance(id, user.userId);
  }

  // فاز ۲۷ — اسناد چندفایلی
  @Post(":id/documents")
  addDocument(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddShipmentDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addDocument(id, dto, user.userId);
  }

  // فاز ۲۷ — درخواست اصلاح مرحلهٔ قفل‌شده
  @Post(":id/edit-requests")
  createEditRequest(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateEditRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createEditRequest(id, dto, user.userId);
  }

  @Post(":id/relock")
  relock(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.relock(id, user.userId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("shipment-documents")
export class ShipmentDocumentsController {
  constructor(private readonly service: ShipmentsService) {}

  @RequirePermissions("shipping.manage_shipment")
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.removeDocument(id, user.userId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("shipment-edit-requests")
export class ShipmentEditRequestsController {
  constructor(private readonly service: ShipmentsService) {}

  @RequirePermissions("shipping.approve_edit")
  @Post(":id/approve")
  approve(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.decideEditRequest(id, "approved", user.userId);
  }

  @RequirePermissions("shipping.approve_edit")
  @Post(":id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.decideEditRequest(id, "rejected", user.userId);
  }
}
