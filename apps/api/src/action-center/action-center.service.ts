import { Inject, Injectable } from "@nestjs/common";
import { ACTION_RULE_PROVIDERS, ActionCenterResponse, ActionRuleProvider } from "./action-item.types";
import { buildSummary, compareItems } from "./action-item.utils";

/**
 * فاز ۳۱ (SPEC-PHASE-31) + توسعهٔ Business Action Hub — مرکز اقدامات، الگوی
 * «صندوق ورودی فدرال» (مثل SAP Fiori My Inbox). این سرویس همچنان Read-Only است
 * و مالک هیچ داده‌ای نیست — فقط از یک رجیستری قابل‌توسعه از ActionRuleProvider
 * (هرکدوم متعلق به دامنهٔ خودش) Query می‌زنه. افزودن یک منبع جدید یعنی یک کلاس
 * تازه که ActionRuleProvider رو پیاده‌سازی می‌کنه + یک خط در Factory Provider
 * ماژول (action-center.module.ts) — بدون نیاز به تغییر این فایل.
 */
@Injectable()
export class ActionCenterService {
  constructor(@Inject(ACTION_RULE_PROVIDERS) private readonly providers: ActionRuleProvider[]) {}

  async getForUser(userId: string, scope: "mine" | "team"): Promise<ActionCenterResponse> {
    const results = await Promise.all(this.providers.map((provider) => provider.getItems(userId, scope)));
    const items = results.flat().sort(compareItems);
    return { summary: buildSummary(items), items };
  }
}
