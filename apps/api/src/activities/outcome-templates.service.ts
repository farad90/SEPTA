import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOutcomeTemplateDto, UpdateOutcomeTemplateDto } from "./dto/outcome-template.dto";

const MANAGEMENT_GROUP_NAME = "مدیریت";

/**
 * فاز ۱۷ — قالب‌های نتیجهٔ فعالیت. طبق SPEC-PHASE-17: مدیریت قالب سفارشی فقط
 * برای اعضای گروه پیش‌فرض «مدیریت» (بدون کلید RBAC جدید)؛ قالب‌های پیش‌فرض
 * (is_default=true) غیرقابل ویرایش/حذف هستن.
 */
@Injectable()
export class OutcomeTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activityType?: string) {
    return this.prisma.activityOutcomeTemplate.findMany({
      where: activityType ? { activityType } : undefined,
      orderBy: [{ activityType: "asc" }, { label: "asc" }],
    });
  }

  async create(dto: CreateOutcomeTemplateDto, currentUserId: string) {
    await this.assertIsManager(currentUserId);

    return this.prisma.activityOutcomeTemplate.create({
      data: {
        activityType: dto.activityType,
        label: dto.label,
        isDefault: false,
        effect: dto.effect ?? "close",
        requiresFollowUp: dto.requiresFollowUp ?? false,
        followUpActivityType: dto.followUpActivityType,
        followUpOffsetMinutes: dto.effect === "create_follow_up" ? dto.followUpOffsetMinutes : undefined,
        createdByUserId: currentUserId,
      },
    });
  }

  async update(id: string, dto: UpdateOutcomeTemplateDto, currentUserId: string) {
    await this.assertIsManager(currentUserId);
    const template = await this.getOrThrow(id);
    if (template.isDefault) {
      throw new BadRequestException("قالب‌های پیش‌فرض قابل ویرایش نیستن");
    }

    return this.prisma.activityOutcomeTemplate.update({
      where: { id },
      data: {
        label: dto.label,
        effect: dto.effect,
        requiresFollowUp: dto.requiresFollowUp,
        followUpActivityType: dto.followUpActivityType,
        followUpOffsetMinutes: dto.followUpOffsetMinutes,
      },
    });
  }

  async remove(id: string, currentUserId: string) {
    await this.assertIsManager(currentUserId);
    const template = await this.getOrThrow(id);
    if (template.isDefault) {
      throw new BadRequestException("قالب‌های پیش‌فرض قابل حذف نیستن");
    }

    await this.prisma.activityOutcomeTemplate.delete({ where: { id } });
    return { success: true };
  }

  private async getOrThrow(id: string) {
    const template = await this.prisma.activityOutcomeTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException("قالب یافت نشد");
    }
    return template;
  }

  private async assertIsManager(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroup: { select: { groupName: true } } },
    });
    if (user?.permissionGroup?.groupName !== MANAGEMENT_GROUP_NAME) {
      throw new ForbiddenException("فقط اعضای گروه مدیریت می‌تونن قالب نتیجه رو مدیریت کنن");
    }
  }
}
