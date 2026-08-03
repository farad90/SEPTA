import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";

/**
 * فاز ۵۱ — بازخورد کاربر: شماره پیشنهاد (و بارکد متناظرش) باید شامل سال + کد اختصاری
 * شرکت مشتری (نه شرکت گروه ما) + سریال باشه. جایگزین شمارنده‌ی سراسری سالانه (فاز ۵۰-الف).
 */
@Injectable()
export class ProposalNumberService {
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
    const rows = await tx.$queryRaw<{ last_serial: number }[]>`
      SELECT last_serial FROM proposal_client_counters
      WHERE year = ${year} AND buyer_partner_id = ${inquiry.buyerId}::uuid FOR UPDATE
    `;

    let serial: number;
    if (rows.length === 0) {
      serial = 1;
      await tx.$executeRaw`
        INSERT INTO proposal_client_counters (year, buyer_partner_id, last_serial)
        VALUES (${year}, ${inquiry.buyerId}::uuid, 1)
      `;
    } else {
      serial = rows[0].last_serial + 1;
      await tx.$executeRaw`
        UPDATE proposal_client_counters SET last_serial = ${serial}
        WHERE year = ${year} AND buyer_partner_id = ${inquiry.buyerId}::uuid
      `;
    }

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
