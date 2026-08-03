import { Controller, Get, NotFoundException, Res } from "@nestjs/common";
import type { Response } from "express";
import { extname } from "path";
import { StorageService } from "../files/storage.service";
import { SiteSettingsService } from "./site-settings.service";

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// ⚠️ عمداً بدون Guard — تصویر پس‌زمینه باید قبل از لاگین قابل نمایش باشه.
// مسیر فایل همیشه سمت سرور از روی همون یک ردیف site_settings خونده می‌شه؛
// هیچ پارامتری از کلاینت گرفته نمی‌شه، پس خطر Path Traversal وجود نداره.
@Controller("public")
export class PublicSiteSettingsController {
  constructor(
    private readonly siteSettings: SiteSettingsService,
    private readonly storage: StorageService,
  ) {}

  @Get("login-background")
  async getLoginBackground(@Res() res: Response) {
    const fileUrl = await this.siteSettings.getLoginBackgroundFileUrl();
    if (!fileUrl) {
      throw new NotFoundException("تصویر پس‌زمینه تنظیم نشده");
    }
    const { stream } = this.storage.openStream(fileUrl);
    const contentType = IMAGE_CONTENT_TYPES[extname(fileUrl).toLowerCase()] ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");
    stream.pipe(res);
  }
}
