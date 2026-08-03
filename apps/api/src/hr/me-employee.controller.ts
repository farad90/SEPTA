import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { HrAccessService } from "./hr-access.service";
import { EmployeesService } from "./employees.service";
import { UpdateMyEmployeeDto } from "./dto/employee.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("me")
export class MeEmployeeController {
  constructor(
    private readonly access: HrAccessService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Get("employee")
  getMyEmployee(@CurrentUser() user: RequestUser) {
    return this.access.getMyEmployee(user.userId);
  }

  @Patch("employee")
  updateMyEmployee(@Body() dto: UpdateMyEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employeesService.updateSelf(user.userId, dto);
  }
}
