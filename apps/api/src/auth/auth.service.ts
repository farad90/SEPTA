import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { MailService } from "../mail/mail.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { buildPasswordResetEmailHtml } from "./password-reset-email.builder";

const REFRESH_TOKEN_BYTES = 48;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MINUTES = 60;
const UNIT_TO_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly permissionsService: PermissionsService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("این ایمیل قبلاً ثبت شده");
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        mobile: dto.mobile,
        email: dto.email,
        requestedDepartment: dto.department,
        passwordHash,
        permissionGroupId: null,
      },
      select: { id: true, fullName: true, email: true },
    });

    return user;
  }

  async validateCredentials(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { mobile: dto.identifier }] },
    });

    if (!user) {
      throw new UnauthorizedException("نام کاربری یا رمز عبور اشتباهه");
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      throw new UnauthorizedException("نام کاربری یا رمز عبور اشتباهه");
    }

    if (user.status !== "active") {
      throw new ForbiddenException("حساب کاربری غیرفعاله");
    }

    if (!user.permissionGroupId) {
      throw new ForbiddenException("حساب شما هنوز توسط مدیر تأیید نشده");
    }

    return user;
  }

  async issueTokens(userId: string, meta: RequestMeta): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL"),
      },
    );

    const { rawToken, tokenHash, expiresAt } = this.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ip,
      },
    });

    return { accessToken, refreshToken: rawToken, refreshTokenExpiresAt: expiresAt };
  }

  async rotateRefreshToken(rawToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });

    if (!existing || existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("نشست شما منقضی شده، دوباره وارد شوید");
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(existing.userId, meta);
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        profilePhotoUrl: true,
        permissionGroup: { select: { groupName: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const permissions = await this.permissionsService.getEffectivePermissions(userId);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      profilePhotoUrl: user.profilePhotoUrl,
      permissionGroup: user.permissionGroup?.groupName ?? null,
      permissions,
    };
  }

  /**
   * درخواست بازیابی رمز عبور — عمداً هیچ‌وقت نشون نمی‌ده کاربر پیدا شده یا نه
   * (جلوگیری از User Enumeration)؛ کنترلر همیشه یک پیام عمومی برمی‌گردونه.
   */
  async forgotPassword(identifier: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { mobile: identifier }] },
    });

    // کاربر یافت نشد، هنوز تأیید نشده، یا ایمیلی برای ارسال لینک نداره — بی‌صدا برمی‌گردیم
    if (!user || user.status !== "active" || !user.permissionGroupId || !user.email) {
      return;
    }

    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetTokenExpiresAt: expiresAt },
    });

    const resetUrl = `${this.config.get<string>("FRONTEND_URL")}/reset-password?token=${rawToken}`;
    const sent = await this.mail.send({
      to: user.email,
      subject: "بازیابی رمز عبور — سامانه سپتا",
      html: buildPasswordResetEmailHtml({
        fullName: user.fullName,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      }),
    });

    // SMTP تنظیم نشده (فقط dev/local) — لینک رو در لاگ سرور می‌ذاریم تا قابل استفاده باشه
    if (!sent) {
      this.logger.warn(`SMTP تنظیم نشده — لینک بازیابی رمز عبور برای ${user.email}: ${resetUrl}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: tokenHash },
    });

    if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("لینک نامعتبر یا منقضی شده — دوباره درخواست بازیابی رمز عبور بدید");
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetTokenExpiresAt: null },
    });

    // بعد از تغییر رمز، همه نشست‌های فعال باطل می‌شن (خروج اجباری از سایر دستگاه‌ها)
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private generateRefreshToken() {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const ttlMs = this.parseTtlToMs(this.config.get<string>("JWT_REFRESH_TTL") ?? "7d");
    const expiresAt = new Date(Date.now() + ttlMs);
    return { rawToken, tokenHash, expiresAt };
  }

  /** خود refresh token هرگز ذخیره نمی‌شه؛ فقط هش SHA-256 آن در دیتابیسه */
  private hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  private parseTtlToMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) {
      return UNIT_TO_MS.d * 7;
    }
    return Number(match[1]) * UNIT_TO_MS[match[2]];
  }
}
