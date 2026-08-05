import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "./decorators/current-user.decorator";

const REFRESH_COOKIE_NAME = "septa_refresh_token";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // P0-E3-F3-T5 — was completely unthrottled; an attacker could script
  // account-creation spam without limit. 5/min/IP, well above any real user's
  // needs (nobody registers 5 times a minute) but low enough to blunt scripted abuse.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return {
      message:
        "درخواست دسترسی شما ثبت شد. بعد از تأیید مدیر و تعیین گروه دسترسی می‌تونید وارد شوید.",
      user,
    };
  }

  // P0-E3-F3-T5 — was completely unthrottled; an attacker could brute-force
  // any known account's password without limit. 5/min/IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateCredentials(dto);
    const tokens = await this.authService.issueTokens(user.id, this.extractMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return {
      accessToken: tokens.accessToken,
      user: { id: user.id, fullName: user.fullName, email: user.email },
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new UnauthorizedException("Refresh token یافت نشد");
    }
    const tokens = await this.authService.rotateRefreshToken(rawToken, this.extractMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  // پیام همیشه یکسانه (چه کاربر پیدا بشه چه نه) — جلوگیری از User Enumeration
  // P0-E3-F3-T5 — was completely unthrottled; an attacker could spam the
  // mail queue or probe for valid accounts via response timing. 5/min/IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.identifier);
    return {
      message: "اگر این موبایل یا ایمیل در سامانه ثبت شده باشه، لینک بازیابی رمز عبور ارسال می‌شه.",
    };
  }

  // P0-E3-F3-T5 — was completely unthrottled; an attacker could brute-force
  // the reset token (a random 32-byte value, so this is defense-in-depth,
  // not the primary defense). 5/min/IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: "رمز عبور با موفقیت تغییر کرد. حالا می‌تونید با رمز جدید وارد بشید." };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await this.authService.revokeRefreshToken(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: "/auth",
      domain: this.config.get<string>("COOKIE_DOMAIN"),
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user.userId);
  }

  private extractMeta(req: Request) {
    return {
      userAgent: req.headers["user-agent"]?.toString(),
      ip: req.ip,
    };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    // COOKIE_SECURE مستقل از NODE_ENV — قبل از داشتن دامنه/HTTPS باید صراحتاً "false" باشه
    // وگرنه مرورگر روی HTTP ساده کوکی رو ذخیره/ارسال نمی‌کنه (لاگین بی‌صدا می‌شکنه)
    const cookieSecure = this.config.get<string>("COOKIE_SECURE") ?? String(process.env.NODE_ENV === "production");
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: cookieSecure === "true",
      sameSite: "lax",
      domain: this.config.get<string>("COOKIE_DOMAIN"),
      path: "/auth",
      expires: expiresAt,
    });
  }
}
