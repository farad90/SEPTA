import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @RequirePermissions("hr.view")
  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions("hr.view")
  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @RequirePermissions("hr.manage")
  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Delete(":id")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
