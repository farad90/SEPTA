import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { EmployeeBenefitsService } from "./employee-benefits.service";
import { CreateEmployeeBenefitDto, UpdateEmployeeBenefitDto } from "./dto/employee-benefit.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EmployeeBenefitsController {
  constructor(private readonly service: EmployeeBenefitsService) {}

  @RequirePermissions("hr.view")
  @Get("employees/:id/benefits")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }

  @RequirePermissions("hr.manage")
  @Post("employees/:id/benefits")
  create(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateEmployeeBenefitDto) {
    return this.service.create(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Patch("employee-benefits/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeBenefitDto) {
    return this.service.update(id, dto);
  }
}
