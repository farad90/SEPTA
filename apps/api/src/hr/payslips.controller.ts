import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PayslipsService } from "./payslips.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PayslipsController {
  constructor(private readonly service: PayslipsService) {}

  @Get("payslips/mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user.userId);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/payslips")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }
}
