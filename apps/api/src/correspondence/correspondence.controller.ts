import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { CorrespondenceService } from "./correspondence.service";
import {
  AddDocumentDto,
  CreateLetterDto,
  ListLettersQueryDto,
  ReferLetterDto,
  UpdateDocumentDto,
  UpdateLetterDto,
  WorkflowActionDto,
} from "./dto/correspondence.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CorrespondenceController {
  constructor(private readonly service: CorrespondenceService) {}

  @RequirePermissions("correspondence.view_own_department")
  @Get("letters")
  list(@Query() query: ListLettersQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.list(query, user.userId);
  }

  @RequirePermissions("correspondence.create")
  @Post("letters")
  create(@Body() dto: CreateLetterDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions("correspondence.view_own_department")
  @Get("letters/:id")
  getById(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.getById(id, user.userId);
  }

  @RequirePermissions("correspondence.create")
  @Patch("letters/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateLetterDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions("correspondence.delete")
  @Delete("letters/:id")
  delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }

  @RequirePermissions("correspondence.register")
  @Post("letters/:id/register")
  register(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.register(id, user.userId);
  }

  @RequirePermissions("correspondence.refer")
  @Post("letters/:id/refer")
  refer(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReferLetterDto, @CurrentUser() user: RequestUser) {
    return this.service.refer(id, dto, user.userId);
  }

  @RequirePermissions("correspondence.archive")
  @Post("letters/:id/workflow")
  workflowAction(@Param("id", ParseUUIDPipe) id: string, @Body() dto: WorkflowActionDto, @CurrentUser() user: RequestUser) {
    return this.service.workflowAction(id, dto, user.userId);
  }

  @RequirePermissions("correspondence.create")
  @Post("letters/:id/documents")
  addDocument(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddDocumentDto, @CurrentUser() user: RequestUser) {
    return this.service.addDocument(id, dto, user.userId);
  }

  @RequirePermissions("correspondence.create")
  @Patch("documents/:id")
  updateDocument(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
    return this.service.updateDocument(id, dto);
  }

  @RequirePermissions("correspondence.create")
  @Delete("documents/:id")
  deleteDocument(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteDocument(id);
  }
}
