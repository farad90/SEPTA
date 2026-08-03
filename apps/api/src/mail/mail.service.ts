import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string;
}

/**
 * زیرساخت مشترک ایمیل (فاز ۴؛ بعداً مکاتبات/اعلان‌ها هم استفاده می‌کنن).
 * اگر SMTP در env تنظیم نشده باشه، سیستم از کار نمی‌افته — ماژول‌ها با
 * isConfigured() چک می‌کنن و مسیر Fallback (کپی دستی متن) رو به کاربر می‌دن.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST");
    const port = this.config.get<string>("SMTP_PORT");
    if (host && port) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth:
          this.config.get<string>("SMTP_USER") && this.config.get<string>("SMTP_PASS")
            ? {
                user: this.config.get<string>("SMTP_USER"),
                pass: this.config.get<string>("SMTP_PASS"),
              }
            : undefined,
      });
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** خروجی: true = ارسال شد، false = SMTP تنظیم نشده. خطای SMTP پرتاب می‌شه. */
  async send(params: SendMailParams): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`SMTP تنظیم نشده — ایمیل «${params.subject}» ارسال نشد`);
      return false;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>("SMTP_FROM") ?? this.config.get<string>("SMTP_USER"),
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
      cc: params.cc,
    });
    return true;
  }
}
