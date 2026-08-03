import {
  Body,
  Controller,
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
import { MAX_FILE_SIZE_BYTES, StorageService } from "./storage.service";

@UseGuards(JwtAuthGuard)
@Controller("files")
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async upload(@UploadedFile() file?: Express.Multer.File, @Body("folder") folder?: string) {
    if (!file) {
      throw new BadRequestException("فایلی ارسال نشده");
    }
    // نام اصلی با multer به‌صورت latin1 می‌آد — برگردوندن UTF-8 برای نام‌های فارسی
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    return this.storage.save(originalName, file.buffer, folder ? { folderHint: folder } : undefined);
  }

  /** دانلود محافظت‌شده — مسیر سال/ماه قدیمی (مثلاً 2026/07/uuid.pdf) */
  @Get(":year/:month/:name")
  download(
    @Param("year") year: string,
    @Param("month") month: string,
    @Param("name") name: string,
    @Res() res: Response,
  ) {
    const fileUrl = `${year}/${month}/${basename(name)}`;
    const { stream } = this.storage.openStream(fileUrl);
    res.setHeader("Content-Disposition", `attachment; filename="${basename(name)}"`);
    stream.pipe(res);
  }

  /** دانلود محافظت‌شده — مسیر پوشه‌بندی‌شده بر مبنای شماره استعلام (فاز ۴۹)، مثلاً INQ-2026-0028/uuid.pdf */
  @Get(":folder/:name")
  downloadFromFolder(
    @Param("folder") folder: string,
    @Param("name") name: string,
    @Res() res: Response,
  ) {
    const fileUrl = `${basename(folder)}/${basename(name)}`;
    const { stream } = this.storage.openStream(fileUrl);
    res.setHeader("Content-Disposition", `attachment; filename="${basename(name)}"`);
    stream.pipe(res);
  }
}
