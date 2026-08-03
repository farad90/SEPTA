import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { UpdateProfileDto, UpsertIdentityDocumentDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  fullNameEn: true,
  phone: true,
  mobile: true,
  email: true,
  profilePhotoUrl: true,
  birthDate: true,
  nationalId: true,
  birthCertificateNo: true,
  address: true,
  permissionGroup: { select: { groupName: true } },
  identityDocuments: {
    select: { id: true, documentType: true, pageNumber: true, fileUrl: true, uploadedAt: true },
    orderBy: [{ documentType: "asc" }, { pageNumber: "asc" }],
  },
} satisfies import("../../generated/prisma").Prisma.UserSelect;

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  mobile: true,
  status: true,
  requestedDepartment: true,
  permissionGroupId: true,
  permissionGroup: { select: { id: true, groupName: true } },
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    return this.prisma.user.findMany({
      where: { permissionGroupId: { not: null } },
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * لیست سبک همکاران فعال (فقط نام) — برای Mention در گفتگوی پرونده؛ همه کاربران لاگین‌شده.
   * forAssignment: برای واگذاری پرونده — اعضای گروه پیش‌فرض «مدیریت» حذف می‌شن (درخواست کاربر)
   */
  async listColleagues(forAssignment = false) {
    return this.prisma.user.findMany({
      where: {
        status: "active",
        permissionGroupId: { not: null },
        ...(forAssignment
          ? { permissionGroup: { NOT: { isDefault: true, groupName: "مدیریت" } } }
          : {}),
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
  }

  /** کاربرانی که هنوز permission_group_id ندارن — یعنی در انتظار تأیید مدیر */
  async listPending() {
    return this.prisma.user.findMany({
      where: { permissionGroupId: null },
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async approve(userId: string, permissionGroupId: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id: permissionGroupId },
    });
    if (!group) {
      throw new NotFoundException("گروه دسترسی یافت نشد");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("کاربر یافت نشد");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { permissionGroupId },
      select: USER_SELECT,
    });
  }

  /** ساخت سریع کاربر توسط مدیر — مستقیم با گروه، بدون فرآیند تأیید */
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("این ایمیل قبلاً ثبت شده");
    }

    const group = await this.prisma.permissionGroup.findUnique({
      where: { id: dto.permissionGroupId },
    });
    if (!group) {
      throw new NotFoundException("گروه دسترسی یافت نشد");
    }

    const passwordHash = await argon2.hash(dto.initialPassword);

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        mobile: dto.mobile,
        passwordHash,
        permissionGroupId: dto.permissionGroupId,
        status: "active",
      },
      select: USER_SELECT,
    });
  }

  /**
   * تغییر گروه/وضعیت کاربر.
   * قانون ایمنی: مدیر نمی‌تونه گروه یا وضعیت خودش رو تغییر بده —
   * جلوگیری از این‌که تنها ادمین سیستم خودش رو قفل کنه.
   */
  async update(userId: string, dto: UpdateUserDto, actingUserId: string) {
    if (userId === actingUserId && (dto.permissionGroupId || dto.status)) {
      throw new BadRequestException("نمی‌تونید گروه دسترسی یا وضعیت حساب خودتون رو تغییر بدید");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("کاربر یافت نشد");
    }

    if (dto.permissionGroupId) {
      const group = await this.prisma.permissionGroup.findUnique({
        where: { id: dto.permissionGroupId },
      });
      if (!group) {
        throw new NotFoundException("گروه دسترسی یافت نشد");
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { ...dto, updatedAt: new Date() },
      select: USER_SELECT,
    });
  }

  /**
   * ریست پسورد یک کاربر توسط مدیر (users.manage) — پاسخ به سناریوی «کاربر رمزش رو فراموش کرده
   * و به ایمیلش دسترسی نداره». بعد از تغییر، همه نشست‌های فعال اون کاربر باطل می‌شن.
   */
  async resetPassword(userId: string, dto: ResetUserPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("کاربر یافت نشد");
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // ------------------------------------------------------------
  // پروفایل من (Self-service — فاز ۱۵) — فقط روی خود کاربر لاگین‌شده
  // ------------------------------------------------------------

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) {
      throw new NotFoundException("کاربر یافت نشد");
    }
    return user;
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    await this.getMyProfile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        updatedAt: new Date(),
      },
      select: PROFILE_SELECT,
    });
  }

  /**
   * تغییر رمز عبور خودسرویس — نیازمند رمز فعلی. بعد از تغییر، سایر نشست‌های فعال
   * (refresh token های دیگه) باطل می‌شن، هم‌الگوی resetPassword توسط مدیر.
   */
  async changeMyPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("کاربر یافت نشد");
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new BadRequestException("رمز عبور فعلی درست نیست");
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * ثبت/جایگزینی یک مدرک هویتی — چون (document_type, page_number) قید Unique نداره،
   * جایگزینی در سطح اپلیکیشن انجام می‌شه: رکورد(های) قبلی همون اسلات حذف می‌شن تا
   * همیشه دقیقاً یک تصویر برای هر اسلات بمونه (طبق SPEC-PHASE-15، تصمیم ۵).
   */
  async upsertIdentityDocument(userId: string, dto: UpsertIdentityDocumentDto) {
    await this.prisma.userIdentityDocument.deleteMany({
      where: { userId, documentType: dto.documentType, pageNumber: dto.pageNumber ?? null },
    });
    await this.prisma.userIdentityDocument.create({
      data: {
        userId,
        documentType: dto.documentType,
        pageNumber: dto.pageNumber,
        fileUrl: dto.fileUrl,
      },
    });
    return this.getMyProfile(userId);
  }

  async deleteIdentityDocument(userId: string, documentId: string) {
    const doc = await this.prisma.userIdentityDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException("مدرک یافت نشد");
    }
    await this.prisma.userIdentityDocument.delete({ where: { id: documentId } });
    return this.getMyProfile(userId);
  }
}
