import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { EmployeeLoansService } from "./employee-loans.service";
import { CreateEmployeeLoanDto } from "./dto/employee-loan.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EmployeeLoansController {
  constructor(private readonly service: EmployeeLoansService) {}

  @Post("employee-loans")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEmployeeLoanDto) {
    return this.service.create(user.userId, dto);
  }

  @Get("employee-loans/mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.service.mine(user.userId);
  }

  @Post("employee-loans/:id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.cancel(user.userId, id);
  }

  @Get("employee-loans/pending-approval")
  pendingApproval(@CurrentUser() user: RequestUser) {
    return this.service.pendingApproval(user.userId);
  }

  @Post("employee-loans/:id/approve")
  approve(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.approve(user.userId, id);
  }

  @Post("employee-loans/:id/reject")
  reject(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.reject(user.userId, id);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id/loans")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }
}
