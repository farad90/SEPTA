import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { BenefitTypesService } from "./benefit-types.service";
import { CreateBenefitTypeDto, UpdateBenefitTypeDto } from "./dto/benefit-type.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("benefit-types")
export class BenefitTypesController {
  constructor(private readonly service: BenefitTypesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions("hr.manage")
  @Post()
  create(@Body() dto: CreateBenefitTypeDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("hr.manage")
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateBenefitTypeDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("hr.manage")
  @Delete(":id")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
