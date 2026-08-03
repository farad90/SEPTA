import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { InquiriesService } from "./inquiries.service";
import {
  AddInquiryDocumentDto,
  AddItemDocumentDto,
  AssignInquiryDto,
  CreateDiscussionMessageDto,
  CreateInquiryDto,
  DeclineInquiryDto,
  CreateInquiryItemDto,
  ListInquiriesQueryDto,
  UpdateInquiryDto,
  UpdateInquiryItemDto,
} from "./dto/inquiry.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class InquiriesController {
  constructor(private readonly service: InquiriesService) {}

  @RequirePermissions("inquiry.view")
  @Get("inquiries")
  list(@Query() query: ListInquiriesQueryDto) {
    return this.service.list(query);
  }

  // باید قبل از "inquiries/:id" تعریف بشه وگرنه ParseUUIDPipe رشته "export" رو رد می‌کنه
  @RequirePermissions("inquiry.view")
  @Get("inquiries/export")
  async export(@Query() query: ListInquiriesQueryDto, @Res() res: Response) {
    const buffer = await this.service.export(query);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="inquiries.xlsx"');
    res.send(buffer);
  }

  @RequirePermissions("inquiry.create")
  @Post("inquiries")
  create(@Body() dto: CreateInquiryDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions("inquiry.view")
  @Get("inquiries/:id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @RequirePermissions("inquiry.edit")
  @Patch("inquiries/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions("inquiry.assign")
  @Patch("inquiries/:id/assign")
  assign(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignInquiryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assign(id, dto.salesExpertId, user.userId);
  }

  @RequirePermissions("inquiry.decline")
  @Post("inquiries/:id/decline")
  decline(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeclineInquiryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.decline(id, dto.reason, user.userId);
  }

  @RequirePermissions("inquiry.delete")
  @Delete("inquiries/:id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.userId);
  }

  @RequirePermissions("inquiry.purge")
  @Get("inquiries-deleted")
  listDeleted() {
    return this.service.listDeleted();
  }

  @RequirePermissions("inquiry.purge")
  @Post("inquiries/:id/restore")
  restore(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.restore(id, user.userId);
  }

  @RequirePermissions("inquiry.purge")
  @Delete("inquiries/:id/purge")
  purge(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.purge(id);
  }

  @RequirePermissions("inquiry.edit")
  @Post("inquiries/:id/items")
  addItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateInquiryItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addItem(id, dto, user.userId);
  }

  @RequirePermissions("inquiry.edit")
  @Patch("inquiry-items/:itemId")
  updateItem(
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateInquiryItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateItem(itemId, dto, user.userId);
  }

  @RequirePermissions("inquiry.edit")
  @Delete("inquiry-items/:itemId")
  removeItem(@Param("itemId", ParseUUIDPipe) itemId: string, @CurrentUser() user: RequestUser) {
    return this.service.removeItem(itemId, user.userId);
  }

  @RequirePermissions("inquiry.edit")
  @Post("inquiry-items/:itemId/documents")
  addItemDocument(
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: AddItemDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addItemDocument(itemId, dto, user.userId);
  }

  @RequirePermissions("inquiry.edit")
  @Delete("inquiry-item-documents/:id")
  removeItemDocument(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.removeItemDocument(id);
  }

  @RequirePermissions("inquiry.edit")
  @Post("inquiries/:id/documents")
  addDocument(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddInquiryDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addDocument(id, dto, user.userId);
  }

  @RequirePermissions("inquiry.edit")
  @Delete("inquiry-documents/:id")
  removeDocument(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.removeDocument(id);
  }

  @RequirePermissions("inquiry.view")
  @Get("inquiries/:id/discussions")
  listDiscussions(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.listDiscussions(id, user.userId);
  }

  @RequirePermissions("inquiry.view")
  @Post("inquiries/:id/discussions")
  addMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateDiscussionMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addMessage(id, dto, user.userId);
  }
}
