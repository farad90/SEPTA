import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { HrAccessService } from "./hr-access.service";
import { LeaveBalancesService } from "./leave-balances.service";
import { SetLeaveBalanceDto } from "./dto/leave-balance.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class LeaveBalancesController {
  constructor(
    private readonly service: LeaveBalancesService,
    private readonly access: HrAccessService,
  ) {}

  @Get("leave-balances/me")
  async myBalances(@CurrentUser() user: RequestUser, @Query("year") year?: string) {
    const employee = await this.access.assertMyEmployee(user.userId);
    return this.service.listForEmployee(employee.id, year ? Number(year) : undefined);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/leave-balances")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string, @Query("year") year?: string) {
    return this.service.listForEmployee(id, year ? Number(year) : undefined);
  }

  @RequirePermissions("hr.manage")
  @Post("employees/:id/leave-balances")
  set(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetLeaveBalanceDto) {
    return this.service.set(id, dto);
  }
}
