import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { EmployeesService } from "./employees.service";
import {
  AssignEmployeeNumberDto,
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  SimilarEmployeesQueryDto,
  UpdateEmployeeDto,
} from "./dto/employee.dto";
import { CreateContractDto, UpdateContractDto } from "./dto/employee-contract.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @RequirePermissions("hr.view")
  @Get("employees")
  list(@Query() query: ListEmployeesQueryDto) {
    return this.service.list(query);
  }

  @RequirePermissions("hr.view")
  @Get("employees/similar")
  findSimilar(@Query() query: SimilarEmployeesQueryDto) {
    return this.service.findSimilar(query.name);
  }

  @RequirePermissions("hr.view")
  @Get("employees/:id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @RequirePermissions("hr.manage")
  @Post("employees")
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Patch("employees/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Patch("employees/:id/assign-number")
  assignNumber(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignEmployeeNumberDto) {
    return this.service.assignNumber(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Post("employees/:id/contracts")
  addContract(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateContractDto) {
    return this.service.addContract(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Patch("employee-contracts/:id")
  updateContract(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.service.updateContract(id, dto);
  }
}
