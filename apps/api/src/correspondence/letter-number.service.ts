import { Injectable } from "@nestjs/common";
import { format as formatJalaliDate } from "date-fns-jalali";
import { Prisma } from "../../generated/prisma";
import { AtomicCounterService } from "../common/atomic-counter/atomic-counter.service";

/**
 * {سال}-{short_code}-{سریال ۴رقمی} — بر مبنای شرکت گروه صادرکننده (نه جهت نامه).
 * سال شمسی برای شرکت‌های calendar_type='jalali'، میلادی برای بقیه — الگوی اتمیک
 * مشابه RfqNumberService، با کلید (year, our_entity_id) روی letter_counters.
 *
 * P1-E5-F1-T1 — atomic increment logic moved to AtomicCounterService.
 */
@Injectable()
export class LetterNumberService {
  constructor(private readonly counter: AtomicCounterService) {}

  async nextNumber(
    tx: Prisma.TransactionClient,
    ourEntityId: string,
    calendarType: string,
    shortCode: string,
    now = new Date(),
  ): Promise<string> {
    const year = calendarType === "jalali" ? parseInt(formatJalaliDate(now, "yyyy"), 10) : now.getFullYear();

    const serial = await this.counter.next(tx, "letter_counters", [
      { column: "year", value: year },
      { column: "our_entity_id", value: ourEntityId, isUuid: true },
    ]);

    return `${year}-${shortCode}-${String(serial).padStart(4, "0")}`;
  }
}
