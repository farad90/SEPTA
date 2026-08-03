import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { OutcomeService } from "./outcome.service";
import { SaveOutcomeDto } from "./dto/outcome.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("inquiries/:id/outcome")
export class OutcomeController {
  constructor(private readonly service: OutcomeService) {}

  @RequirePermissions("outcome.record")
  @Get()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getOutcome(id);
  }

  @RequirePermissions("outcome.record")
  @Put()
  save(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveOutcomeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.saveOutcome(id, dto, user.userId);
  }
}
