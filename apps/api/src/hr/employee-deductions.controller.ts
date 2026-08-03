import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { EmployeeDeductionsService } from "./employee-deductions.service";
import { CreateEmployeeDeductionDto, UpdateEmployeeDeductionDto } from "./dto/employee-deduction.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EmployeeDeductionsController {
  constructor(private readonly service: EmployeeDeductionsService) {}

  @RequirePermissions("hr.view")
  @Get("employees/:id/deductions")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }

  @RequirePermissions("hr.manage")
  @Post("employees/:id/deductions")
  create(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateEmployeeDeductionDto) {
    return this.service.create(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Patch("employee-deductions/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDeductionDto) {
    return this.service.update(id, dto);
  }
}
