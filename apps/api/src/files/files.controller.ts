import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { basename } from "path";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { MAX_FILE_SIZE_BYTES, StorageService } from "./storage.service";
import { FileAccessService } from "./file-access.service";

@UseGuards(JwtAuthGuard)
@Controller("files")
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    private readonly fileAccess: FileAccessService,
  ) {}

  // P0-E3-F1-T2 — folder was previously accepted from the client with zero
  // validation that the caller may write into it. Only inquiry-named
  // folders are actually resolvable (see FileAccessService) — anything else
  // falls through unchanged (documented residual gap, not a regression).
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body("folder") folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException("فایلی ارسال نشده");
    }
    if (folder) {
      const allowed = await this.fileAccess.canAccessInquiryFolder(basename(folder), user.userId, true);
      if (!allowed) {
        throw new ForbiddenException("اجازه‌ی بارگذاری فایل در این پرونده رو ندارید");
      }
    }
    // نام اصلی با multer به‌صورت latin1 می‌آد — برگردوندن UTF-8 برای نام‌های فارسی
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    return this.storage.save(originalName, file.buffer, folder ? { folderHint: folder } : undefined);
  }

  // P0-E3-F1-T1 — the legacy year/month path carries no entity information
  // at all (see FileAccessService's class-level note on the residual gap);
  // this can't be authorized from the path alone, so it's logged instead.
  /** دانلود محافظت‌شده — مسیر سال/ماه قدیمی (مثلاً 2026/07/uuid.pdf) */
  @Get(":year/:month/:name")
  download(
    @Param("year") year: string,
    @Param("month") month: string,
    @Param("name") name: string,
    @Res() res: Response,
    @CurrentUser() user: RequestUser,
  ) {
    const fileUrl = `${year}/${month}/${basename(name)}`;
    this.fileAccess.logAccessToUnscopedFile(user.userId, fileUrl);
    const { stream } = this.storage.openStream(fileUrl);
    res.setHeader("Content-Disposition", `attachment; filename="${basename(name)}"`);
    stream.pipe(res);
  }

  // P0-E3-F1-T1 — this is the fix for the audit's headline finding: any
  // authenticated user could previously download any file in any inquiry's
  // folder. Now requires inquiry.view (or inquiry.edit for upload) AND the
  // same ownership/department scope InquiriesService.getById enforces
  // (P0-E3-F2-T3) — a folder outside the caller's scope is rejected, not
  // silently served.
  /** دانلود محافظت‌شده — مسیر پوشه‌بندی‌شده بر مبنای شماره استعلام (فاز ۴۹)، مثلاً INQ-2026-0028/uuid.pdf */
  @Get(":folder/:name")
  async downloadFromFolder(
    @Param("folder") folder: string,
    @Param("name") name: string,
    @Res() res: Response,
    @CurrentUser() user: RequestUser,
  ) {
    const safeFolder = basename(folder);
    const allowed = await this.fileAccess.canAccessInquiryFolder(safeFolder, user.userId);
    if (!allowed) {
      throw new ForbiddenException("اجازه‌ی دسترسی به این فایل رو ندارید");
    }
    const fileUrl = `${safeFolder}/${basename(name)}`;
    const { stream } = this.storage.openStream(fileUrl);
    res.setHeader("Content-Disposition", `attachment; filename="${basename(name)}"`);
    stream.pipe(res);
  }
}
