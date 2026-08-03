import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { PoService } from "./po.service";
import { SavePoDto, SaveSupplierPaymentDto } from "./dto/po.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PoController {
  constructor(private readonly service: PoService) {}

  @RequirePermissions("po.view")
  @Get("inquiries/:id/purchase-orders")
  getAll(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getPurchaseOrders(id);
  }

  @RequirePermissions("po.create")
  @Put("inquiries/:id/purchase-orders/:supplierId")
  save(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() dto: SavePoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.savePo(id, supplierId, dto, user.userId);
  }

  @RequirePermissions("po.manage_payments")
  @Post("inquiries/:id/purchase-orders/:supplierId/payments")
  addPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() dto: SaveSupplierPaymentDto,
  ) {
    return this.service.addPayment(id, supplierId, dto);
  }

  @RequirePermissions("po.manage_payments")
  @Patch("po-payments/:id")
  updatePayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveSupplierPaymentDto) {
    return this.service.updatePayment(id, dto);
  }

  @RequirePermissions("po.manage_payments")
  @Delete("po-payments/:id")
  deletePayment(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deletePayment(id);
  }
}
