import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { DeductionTypesService } from "./deduction-types.service";
import { CreateDeductionTypeDto, UpdateDeductionTypeDto } from "./dto/deduction-type.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("deduction-types")
export class DeductionTypesController {
  constructor(private readonly service: DeductionTypesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions("hr.manage")
  @Post()
  create(@Body() dto: CreateDeductionTypeDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDeductionTypeDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Delete(":id")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
