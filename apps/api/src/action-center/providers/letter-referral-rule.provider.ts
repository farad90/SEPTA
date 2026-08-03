import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ActionItem, ActionPriority, ActionRuleProvider } from "../action-item.types";

const LETTER_PRIORITY: Record<string, ActionPriority> = {
  very_urgent: "urgent",
  urgent: "high",
  normal: "normal",
};

/** منبع #۴ — نامه‌های ارجاع‌شده به من (فاز ۲۴) که هنوز بایگانی نشدن */
@Injectable()
export class LetterReferralRuleProvider implements ActionRuleProvider {
  constructor(private readonly prisma: PrismaService) {}

  async getItems(userId: string, _scope?: "mine" | "team"): Promise<ActionItem[]> {
    const letters = await this.prisma.letter.findMany({
      where: { responsibleUserId: userId, status: { not: "archived" } },
      select: { id: true, subject: true, letterNumber: true, priority: true, letterDate: true },
      orderBy: { letterDate: "desc" },
    });

    return letters.map((l) => ({
      id: `letter_referral:${l.id}`,
      sourceType: "letter_referral",
      sourceId: l.id,
      source: "documents",
      kind: "task",
      title: `نامه ${l.letterNumber ?? "(پیش‌نویس)"}: ${l.subject}`,
      subtitle: "نامهٔ ارجاع‌شده — نیاز به پیگیری",
      priority: LETTER_PRIORITY[l.priority] ?? "normal",
      dueAt: null,
      isOverdue: false,
      origin: "assigned",
      relatedEntityType: "letter",
      relatedEntityId: l.id,
      linkPath: `/correspondence/${l.id}`,
      actions: [],
      createdAt: l.letterDate.toISOString(),
    }));
  }
}
