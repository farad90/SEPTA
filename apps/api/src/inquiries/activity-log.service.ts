import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type ActivityTag =
  | "general"
  | "technical_question"
  | "file_upload"
  | "status_change"
  | "stage_completed"
  | "approval";

/**
 * سرویس Cross-Cutting لاگ فعالیت پرونده (design doc، دامنه ۲):
 * هر ماژولی که روی یک پرونده استعلام کار می‌کنه (RFQ، انتخاب نهایی، پیشنهاد،
 * سفارش، PO، حمل، تسویه) باید هنگام «اقدامات مهم» همین متد رو صدا بزنه —
 * نه هر تغییر جزئی فرم. خروجی در فید ترکیبی inquiry_discussions می‌شینه.
 */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    inquiryId: string;
    authorId: string;
    text: string;
    /**
     * نسخه‌ی عمومی بدون جزئیات بازرگانی حساس (نام تأمین‌کننده، مبلغ) — فاز ۳۴.
     * وقتی پر باشه، کاربرانی که `inquiry.view_commercial_details` ندارن (فروش)
     * این نسخه رو به‌جای `text` کامل می‌بینن.
     */
    restrictedText?: string;
    tag?: ActivityTag;
    metadata?: Record<string, unknown>;
    sourceRfqId?: string;
  }) {
    return this.prisma.inquiryDiscussion.create({
      data: {
        inquiryId: params.inquiryId,
        entryType: "activity",
        authorId: params.authorId,
        commentText: params.text,
        commentTextRestricted: params.restrictedText,
        tag: params.tag ?? "general",
        metadata: params.metadata as never,
        sourceRfqId: params.sourceRfqId,
      },
    });
  }
}
