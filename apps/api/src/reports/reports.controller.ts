import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { ReportsService } from "./reports.service";
import { ConversionQueryDto, OrdersPnlQueryDto, PaymentsQueryDto } from "./dto/reports.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @RequirePermissions("reports.view_orders_pnl")
  @Get("orders-pnl")
  ordersPnl(@Query() query: OrdersPnlQueryDto) {
    return this.service.getOrdersPnl(query);
  }

  @RequirePermissions("reports.view_payments")
  @Get("payments")
  payments(@Query() query: PaymentsQueryDto) {
    return this.service.getPayments(query);
  }

  @RequirePermissions("reports.view_conversion")
  @Get("conversion")
  conversion(@Query() query: ConversionQueryDto) {
    return this.service.getConversion(query);
  }

  @RequirePermissions("reports.view_own_sales_summary")
  @Get("own-sales-summary")
  ownSalesSummary(@CurrentUser() user: RequestUser) {
    return this.service.getOwnSalesSummary(user.userId);
  }

  @RequirePermissions("reports.view_rfq_response_rate")
  @Get("rfq-response-rate")
  rfqResponseRate() {
    return this.service.getRfqResponseRate();
  }
}
