import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CreateEmployeeChildDto } from "./dto/employee-child.dto";
import { EmployeeChildrenService } from "./employee-children.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EmployeeChildrenController {
  constructor(private readonly service: EmployeeChildrenService) {}

  @RequirePermissions("hr.view")
  @Get("employees/:id/children")
  listForEmployee(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForEmployee(id);
  }

  @RequirePermissions("hr.manage")
  @Post("employees/:id/children")
  create(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateEmployeeChildDto) {
    return this.service.create(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Delete("employee-children/:id")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
