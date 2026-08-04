import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AtomicCounterService } from "../common/atomic-counter/atomic-counter.service";

/**
 * فاز ۵۱ — بازخورد کاربر: شماره پیشنهاد (و بارکد متناظرش) باید شامل سال + کد اختصاری
 * شرکت مشتری (نه شرکت گروه ما) + سریال باشه. جایگزین شمارنده‌ی سراسری سالانه (فاز ۵۰-الف).
 *
 * P1-E5-F1-T1 — atomic increment logic moved to AtomicCounterService; the
 * buyer/short-code lookup above it (business logic, not counter logic) is
 * unchanged.
 */
@Injectable()
export class ProposalNumberService {
  constructor(private readonly counter: AtomicCounterService) {}

  async nextNumber(tx: Prisma.TransactionClient, inquiryId: string, now = new Date()): Promise<string> {
    const inquiry = await tx.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      select: { buyerId: true },
    });
    const buyer = await tx.businessPartner.findUniqueOrThrow({
      where: { id: inquiry.buyerId },
      select: { shortCodeEn: true, companyNameEn: true },
    });
    const shortCode = buyer.shortCodeEn || this.deriveFallbackCode(buyer.companyNameEn) || "CLIENT";

    const year = now.getFullYear();
    const serial = await this.counter.next(tx, "proposal_client_counters", [
      { column: "year", value: year },
      { column: "buyer_partner_id", value: inquiry.buyerId, isUuid: true },
    ]);

    return `${year}-${shortCode}-${String(serial).padStart(4, "0")}`;
  }

  /** اگه مشتری نه کد اختصاری دستی داره نه company_name_en — بازم یک کد قابل‌استفاده لازمه */
  private deriveFallbackCode(companyNameEn?: string | null): string | undefined {
    if (!companyNameEn?.trim()) return undefined;
    const initials = companyNameEn
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .filter((ch) => /[a-zA-Z]/.test(ch))
      .join("")
      .toUpperCase();
    return initials || undefined;
  }
}
