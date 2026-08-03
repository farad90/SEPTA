import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface EffectivePermission {
  permissionKey: string;
  limitValue: number | null;
}

/**
 * دسترسی‌ها هیچ‌وقت داخل JWT قرار نمی‌گیرن — این سرویس همیشه از دیتابیس
 * می‌خونه تا تغییر گروه دسترسی توسط مدیر، همون درخواست بعدی کاربر اثر کنه.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroupId: true },
    });

    if (!user?.permissionGroupId) {
      return [];
    }

    const items = await this.prisma.permissionGroupItem.findMany({
      where: { permissionGroupId: user.permissionGroupId },
      include: { permission: true },
    });

    return items.map((item) => ({
      permissionKey: item.permission.permissionKey,
      limitValue: item.limitValue ? Number(item.limitValue) : null,
    }));
  }

  async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(userId);
    return permissions.some((permission) => permission.permissionKey === permissionKey);
  }
}
