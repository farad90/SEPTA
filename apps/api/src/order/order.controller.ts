import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { OrderService } from "./order.service";
import { SaveCustomerPaymentDto, SaveGuaranteeDto, SaveOrderDto } from "./dto/order.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @RequirePermissions("order.view")
  @Get("inquiries/:id/order")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getOrder(id);
  }

  @RequirePermissions("order.create")
  @Put("inquiries/:id/order")
  save(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.saveOrder(id, dto, user.userId);
  }

  @RequirePermissions("order.manage_payments")
  @Post("inquiries/:id/order/payments")
  addPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveCustomerPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addPayment(id, dto, user.userId);
  }

  @RequirePermissions("order.manage_payments")
  @Patch("order-payments/:id")
  updatePayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveCustomerPaymentDto) {
    return this.service.updatePayment(id, dto);
  }

  @RequirePermissions("order.manage_payments")
  @Delete("order-payments/:id")
  deletePayment(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deletePayment(id);
  }

  @RequirePermissions("order.manage_payments")
  @Post("inquiries/:id/order/guarantees")
  addGuarantee(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveGuaranteeDto) {
    return this.service.addGuarantee(id, dto);
  }

  @RequirePermissions("order.manage_payments")
  @Patch("order-guarantees/:id")
  updateGuarantee(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveGuaranteeDto) {
    return this.service.updateGuarantee(id, dto);
  }

  @RequirePermissions("order.manage_payments")
  @Delete("order-guarantees/:id")
  deleteGuarantee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteGuarantee(id);
  }
}
