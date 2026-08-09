import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGroupDto, UpdateGroupDto } from "./dto/group.dto";
import {
  BROAD_NARROW_FAMILIES,
  DEPENDENT_PERMISSION_KEYS,
  SOD_SENSITIVE_PAIRS,
} from "../../prisma/permission-catalog";

@Injectable()
export class PermissionGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** کاتالوگ کامل دسترسی‌ها گروه‌بندی‌شده بر اساس ماژول — برای رندر چک‌باکس‌ها در UI */
  async getPermissionCatalog() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { permissionKey: "asc" }],
    });

    const byModule = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const group = byModule.get(permission.module) ?? [];
      group.push(permission);
      byModule.set(permission.module, group);
    }

    return [...byModule.entries()].map(([module, items]) => ({ module, items }));
  }

  async list() {
    const groups = await this.prisma.permissionGroup.findMany({
      include: {
        items: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return groups.map((group) => ({
      id: group.id,
      groupName: group.groupName,
      isDefault: group.isDefault,
      memberCount: group._count.users,
      permissionKeys: group.items.map((item) => item.permission.permissionKey),
    }));
  }

  async create(dto: CreateGroupDto, createdBy: string) {
    const duplicate = await this.prisma.permissionGroup.findFirst({
      where: { groupName: dto.groupName },
    });
    if (duplicate) {
      throw new BadRequestException("گروهی با این نام قبلاً ساخته شده");
    }

    const { keys: normalizedKeys, warnings } = this.normalizeAndValidateKeys(dto.permissionKeys);
    const permissions = await this.resolveKeys(normalizedKeys);

    const group = await this.prisma.permissionGroup.create({
      data: {
        groupName: dto.groupName,
        isDefault: false,
        createdBy,
        items: {
          create: permissions.map((permission) => ({ permissionId: permission.id })),
        },
      },
    });

    return { ...(await this.getById(group.id)), warnings };
  }

  async getById(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: {
        items: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!group) {
      throw new NotFoundException("گروه دسترسی یافت نشد");
    }
    return {
      id: group.id,
      groupName: group.groupName,
      isDefault: group.isDefault,
      memberCount: group._count.users,
      permissionKeys: group.items.map((item) => item.permission.permissionKey),
    };
  }

  /**
   * قوانین ایمنی:
   * - نام گروه‌های پیش‌فرض قابل تغییر نیست (چک‌باکس‌هاشون چرا)
   * - کاربر نمی‌تونه گروه خودش رو ویرایش کنه (جلوگیری از سلب دسترسی خود مدیر)
   */
  async update(id: string, dto: UpdateGroupDto, actingUserId: string) {
    const group = await this.prisma.permissionGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException("گروه دسترسی یافت نشد");
    }

    const actingUser = await this.prisma.user.findUnique({
      where: { id: actingUserId },
      select: { permissionGroupId: true },
    });
    if (actingUser?.permissionGroupId === id) {
      throw new ForbiddenException("نمی‌تونید گروه دسترسی خودتون رو ویرایش کنید");
    }

    if (dto.groupName && group.isDefault && dto.groupName !== group.groupName) {
      throw new BadRequestException("نام گروه‌های پیش‌فرض قابل تغییر نیست");
    }

    if (dto.groupName) {
      await this.prisma.permissionGroup.update({
        where: { id },
        data: { groupName: dto.groupName },
      });
    }

    let warnings: string[] = [];
    if (dto.permissionKeys) {
      const normalized = this.normalizeAndValidateKeys(dto.permissionKeys);
      warnings = normalized.warnings;
      const permissions = await this.resolveKeys(normalized.keys);
      await this.prisma.$transaction([
        this.prisma.permissionGroupItem.deleteMany({ where: { permissionGroupId: id } }),
        this.prisma.permissionGroupItem.createMany({
          data: permissions.map((permission) => ({
            permissionGroupId: id,
            permissionId: permission.id,
          })),
        }),
      ]);
    }

    return { ...(await this.getById(id)), warnings };
  }

  /** حذف فقط برای گروه غیرپیش‌فرضِ بدون عضو */
  async remove(id: string, actingUserId: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!group) {
      throw new NotFoundException("گروه دسترسی یافت نشد");
    }
    if (group.isDefault) {
      throw new BadRequestException("گروه‌های پیش‌فرض سیستم قابل حذف نیستن");
    }
    if (group._count.users > 0) {
      throw new BadRequestException(
        `این گروه ${group._count.users} عضو داره — اول اعضا رو به گروه دیگه منتقل کنید`,
      );
    }

    const actingUser = await this.prisma.user.findUnique({
      where: { id: actingUserId },
      select: { permissionGroupId: true },
    });
    if (actingUser?.permissionGroupId === id) {
      throw new ForbiddenException("نمی‌تونید گروه دسترسی خودتون رو حذف کنید");
    }

    await this.prisma.permissionGroup.delete({ where: { id } });
    return { success: true };
  }

  /**
   * فاز ۵۸ — سه نوع تداخل شناسایی‌شده در ممیزی کامل کاتالوگ رو قبل از ذخیره اعمال می‌کنه:
   * ۱) خانواده‌ی «گسترده جایگزین محدود» (مثل partners.view در برابر view_customers/
   *    view_suppliers): وقتی broad حاضره، narrow های همون خانواده به‌صورت خاموش از ست حذف
   *    می‌شن (نه خطا — چون broad قبلاً قابلیتشون رو داره، این فقط پاک‌سازی چک‌باکس گمراه‌کننده‌ست)
   * ۲) دسترسی وابسته بدون پایه‌ش (مثل inquiry.view_all بدون inquiry.view): خطای صریح، چون
   *    اضافه‌کردن خاموش دسترسی پایه می‌تونه یک قابلیت ناخواسته به گروه بده
   * ۳) جفت‌های حساس SoD (مثل proposal.edit_price + proposal.approve_price_reduction): این‌ها
   *    Business Decision هستن نه خطای فنی — فقط به‌عنوان warning برمی‌گردن، ذخیره مسدود نمی‌شه
   */
  private normalizeAndValidateKeys(inputKeys: string[]): { keys: string[]; warnings: string[] } {
    const keys = new Set(inputKeys);

    for (const { broad, narrow } of BROAD_NARROW_FAMILIES) {
      if (keys.has(broad)) {
        narrow.forEach((key) => keys.delete(key));
      }
    }

    for (const { key, requires } of DEPENDENT_PERMISSION_KEYS) {
      if (keys.has(key) && !keys.has(requires)) {
        throw new BadRequestException(
          `دسترسی «${key}» بدون دسترسی پایه «${requires}» هیچ اثری نداره — اول «${requires}» رو هم تیک بزنید`,
        );
      }
    }

    const warnings = SOD_SENSITIVE_PAIRS.filter(
      ({ pair }) => keys.has(pair[0]) && keys.has(pair[1]),
    ).map(({ message }) => message);

    return { keys: [...keys], warnings };
  }

  private async resolveKeys(keys: string[]) {
    const unique = [...new Set(keys)];
    const permissions = await this.prisma.permission.findMany({
      where: { permissionKey: { in: unique } },
    });
    if (permissions.length !== unique.length) {
      const found = new Set(permissions.map((permission) => permission.permissionKey));
      const missing = unique.filter((key) => !found.has(key));
      throw new BadRequestException(`کلید(های) دسترسی نامعتبر: ${missing.join(", ")}`);
    }
    return permissions;
  }
}
