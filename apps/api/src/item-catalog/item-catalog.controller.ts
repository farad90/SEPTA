import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ItemCatalogService } from "./item-catalog.service";
import {
  AddCatalogDocumentDto,
  CreateItemDto,
  CreateUnitDto,
  ListItemsQueryDto,
  SimilarItemsQueryDto,
  UpdateItemDto,
} from "./dto/item.dto";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sendXlsx(res: Response, buffer: Buffer, filename: string) {
  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("item-catalog")
export class ItemCatalogController {
  constructor(private readonly service: ItemCatalogService) {}

  @RequirePermissions("catalog.view")
  @Get()
  list(@Query() query: ListItemsQueryDto) {
    return this.service.list(query);
  }

  // واحدهای اندازه‌گیری — لیست برای همه کاربران لاگین‌شده؛ افزودن با دسترسی جدا
  @Get("measurement-units")
  listUnits() {
    return this.service.listUnits();
  }

  @RequirePermissions("catalog.manage_units")
  @Post("measurement-units")
  addUnit(@Body() dto: CreateUnitDto) {
    return this.service.addUnit(dto.unitName);
  }

  @RequirePermissions("catalog.create")
  @Get("similar")
  findSimilar(@Query() query: SimilarItemsQueryDto) {
    return this.service.findSimilar(query.code, query.description);
  }

  @RequirePermissions("catalog.create")
  @Post()
  create(@Body() dto: CreateItemDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  // ------------------------------------------------------------
  // Import/Export اکسل — فاز ۲۵ (باید قبل از مسیرهای عمومی :code تعریف بشن)
  // ------------------------------------------------------------

  @RequirePermissions("catalog.view")
  @Get("export")
  async export(@Query() query: ListItemsQueryDto, @Res() res: Response) {
    const buffer = await this.service.export(query);
    sendXlsx(res, buffer, "catalog.xlsx");
  }

  @RequirePermissions("catalog.import")
  @Get("import-template")
  async importTemplate(@Res() res: Response) {
    const buffer = await this.service.buildImportTemplate();
    sendXlsx(res, buffer, "catalog-import-template.xlsx");
  }

  @RequirePermissions("catalog.import")
  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  async import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException("فایلی ارسال نشده");
    }
    return this.service.importFromExcel(file.buffer, user.userId);
  }

  @RequirePermissions("catalog.view")
  @Get(":code")
  getByCode(@Param("code") code: string) {
    return this.service.getByCode(code);
  }

  @RequirePermissions("catalog.create")
  @Patch(":code")
  update(@Param("code") code: string, @Body() dto: UpdateItemDto) {
    return this.service.update(code, dto);
  }

  @RequirePermissions("catalog.create")
  @Delete(":code")
  remove(@Param("code") code: string) {
    return this.service.remove(code);
  }

  @RequirePermissions("catalog.create")
  @Post(":code/documents")
  addDocument(
    @Param("code") code: string,
    @Body() dto: AddCatalogDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addDocument(code, dto, user.userId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("item-catalog-documents")
export class ItemCatalogDocumentsController {
  constructor(private readonly service: ItemCatalogService) {}

  @RequirePermissions("catalog.create")
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.removeDocument(id);
  }
}
