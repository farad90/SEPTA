import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateLoginBackgroundDto } from "./dto/update-login-background.dto";

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // الگوی تک‌ردیفی (singleton) — دقیقاً کپی CatalogCounter — لِیزی upsert روی ردیف id=1
  getSettings() {
    return this.prisma.siteSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  async updateLoginBackground(dto: UpdateLoginBackgroundDto, userId: string) {
    return this.prisma.siteSettings.upsert({
      where: { id: 1 },
      update: { loginBackgroundUrl: dto.loginBackgroundUrl ?? null, updatedBy: userId },
      create: { id: 1, loginBackgroundUrl: dto.loginBackgroundUrl ?? null, updatedBy: userId },
    });
  }

  async getLoginBackgroundFileUrl(): Promise<string | null> {
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: 1 } });
    return settings?.loginBackgroundUrl ?? null;
  }
}
