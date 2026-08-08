import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { ActivitiesService } from "../activities/activities.service";
import { SaveOutcomeDto } from "./dto/outcome.dto";

const MODE_LABELS: Record<string, string> = {
  won_all: "برد کامل",
  lost_all: "باخت کامل",
  cancelled: "لغو شده",
  mixed: "ترکیبی (بخشی برد، بخشی باخت)",
};

/**
 * فاز ۷ — نتیجه نهایی برد/باخت (تب ۵). طبق تصمیم کاربر: هر ذخیره، نتیجه همه اقلام
 * پرونده رو هم‌زمان بازنویسی می‌کنه (نه ذخیره تدریجی/جزئی) — بدون قید از تب‌های قبل.
 */
@Injectable()
export class OutcomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly activities: ActivitiesService,
  ) {}

  async getOutcome(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        items: {
          // فاز ۴۶ — نتیجه نهایی فقط برای ردیف‌هایی معنا داره که پیشنهادی براشون انتخاب شده؛
          // ردیف‌هایی که هیچ‌وقت به مرحله «انتخاب نهایی» نرسیدن، اصلاً به مشتری پیشنهاد نشدن
          where: { selectedOfferItemId: { not: null } },
          orderBy: { rowIndex: "asc" },
          include: { outcome: true },
        },
      },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }

    return {
      inquiryId,
      status: inquiry.status,
      items: inquiry.items.map((item) => ({
        inquiryItemId: item.id,
        rowIndex: item.rowIndex,
        itemCode: item.itemCode,
        description: item.description,
        quantity: Number(item.quantity),
        measurementUnit: item.measurementUnit,
        outcome: item.outcome
          ? {
              result: item.outcome.result,
              decisionDate: item.outcome.decisionDate,
              lossReason: item.outcome.lossReason,
              competitorName: item.outcome.competitorName,
              competitorPrice:
                item.outcome.competitorPrice != null ? Number(item.outcome.competitorPrice) : null,
              winReason: item.outcome.winReason,
              expertNote: item.outcome.expertNote,
            }
          : null,
      })),
    };
  }

  async saveOutcome(inquiryId: string, dto: SaveOutcomeDto, currentUserId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        id: true,
        deletedAt: true,
        // فاز ۴۶ — فقط ردیف‌های دارای پیشنهاد منتخب وارد فرآیند برد/باخت می‌شن
        items: { where: { selectedOfferItemId: { not: null } }, select: { id: true } },
      },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    if (inquiry.items.length === 0) {
      throw new BadRequestException("هیچ قلمی به مرحله انتخاب نهایی نرسیده — امکان ثبت نتیجه نیست");
    }

    const itemIds = inquiry.items.map((i) => i.id);
    const resultByItem = new Map<string, "won" | "lost" | "cancelled">();

    if (dto.mode === "won_all") {
      itemIds.forEach((id) => resultByItem.set(id, "won"));
    } else if (dto.mode === "lost_all") {
      itemIds.forEach((id) => resultByItem.set(id, "lost"));
    } else if (dto.mode === "cancelled") {
      itemIds.forEach((id) => resultByItem.set(id, "cancelled"));
    } else {
      const provided = dto.itemResults ?? {};
      const missing = itemIds.filter((id) => !provided[id]);
      const foreign = Object.keys(provided).filter((id) => !itemIds.includes(id));
      if (missing.length > 0 || foreign.length > 0) {
        throw new BadRequestException("در حالت ترکیبی باید نتیجه (برد/باخت) همه اقلام پرونده مشخص بشه");
      }
      for (const id of itemIds) {
        const value = provided[id];
        if (value !== "won" && value !== "lost") {
          throw new BadRequestException("نتیجه هر قلم در حالت ترکیبی باید «برد» یا «باخت» باشه");
        }
        resultByItem.set(id, value);
      }
    }

    const decisionDate = new Date(dto.decisionDate);
    await this.prisma.$transaction(
      itemIds.map((itemId) => {
        const result = resultByItem.get(itemId)!;
        const data = {
          result,
          decisionDate,
          winReason: result === "won" ? (dto.winReason ?? null) : null,
          lossReason: result === "lost" ? (dto.lossReason ?? null) : null,
          competitorName: result === "lost" ? (dto.competitorName ?? null) : null,
          competitorPrice: result === "lost" ? (dto.competitorPrice ?? null) : null,
          expertNote: dto.note ?? null,
        };
        return this.prisma.inquiryItemOutcome.upsert({
          where: { inquiryItemId: itemId },
          create: { inquiryItemId: itemId, ...data },
          update: data,
        });
      }),
    );

    const results = [...resultByItem.values()];
    const allWon = results.every((r) => r === "won");
    const allLost = results.every((r) => r === "lost");
    const allCancelled = results.every((r) => r === "cancelled");
    const status = allWon ? "won" : allLost ? "lost" : allCancelled ? "cancelled" : "partially_won";

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status, updatedAt: new Date() },
    });

    await this.activityLog.log({
      inquiryId,
      authorId: currentUserId,
      text: `نتیجه نهایی پرونده ثبت شد: ${MODE_LABELS[dto.mode]}`,
      tag: "stage_completed",
      metadata: { module: "outcome", action: "recorded", mode: dto.mode, status },
    });

    // فاز ۵۸ — Trigger #۵ (erp-database-design.md دامنه ۱۴)
    await this.advanceAfterOutcome(inquiryId, results.some((r) => r === "won"), currentUserId);

    return this.getOutcome(inquiryId);
  }

  /**
   * awaiting_customer_outcome همیشه بسته می‌شه (نتیجه‌ای ثبت شد). اگه حداقل یک قلم برد داشته
   * باشه (won/partially_won)، order_pending برای Sales Owner و po_pending برای Procurement
   * Owner باز می‌شن (هرکدوم Watcher اون‌یکی، طبق تصمیم تأییدشده «Watcher مختص Trigger»)؛
   * باخت/لغو کامل مسیر رو بدون Activity جدید پایان می‌ده.
   */
  private async advanceAfterOutcome(inquiryId: string, hasWonItem: boolean, currentUserId: string) {
    await this.activities.closeStageActivities(inquiryId, "awaiting_customer_outcome", currentUserId);
    if (!hasWonItem) return;

    const inquiry = await this.prisma.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
      select: { salesExpertId: true, procurementOwnerId: true },
    });
    const procurementAssignee = inquiry.procurementOwnerId ?? currentUserId;

    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "order_pending",
      activityType: "internal_task",
      subject: "ثبت سفارش مشتری",
      assignedToUserId: inquiry.salesExpertId,
      triggeredByUserId: currentUserId,
      extraWatcherUserIds: [procurementAssignee],
    });
    await this.activities.openStageActivity({
      inquiryId,
      stageCode: "po_pending",
      activityType: "internal_task",
      subject: "صدور سفارش خرید (PO)",
      assignedToUserId: procurementAssignee,
      triggeredByUserId: currentUserId,
      extraWatcherUserIds: [inquiry.salesExpertId],
    });
  }
}
