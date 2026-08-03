import { Injectable } from "@nestjs/common";
import { format as formatJalaliDate } from "date-fns-jalali";
import { Prisma } from "../../generated/prisma";

/**
 * {سال}-{short_code}-{سریال ۴رقمی} — بر مبنای شرکت گروه صادرکننده (نه جهت نامه).
 * سال شمسی برای شرکت‌های calendar_type='jalali'، میلادی برای بقیه — الگوی اتمیک
 * مشابه RfqNumberService، با کلید (year, our_entity_id) روی letter_counters.
 */
@Injectable()
export class LetterNumberService {
  async nextNumber(
    tx: Prisma.TransactionClient,
    ourEntityId: string,
    calendarType: string,
    shortCode: string,
    now = new Date(),
  ): Promise<string> {
    const year = calendarType === "jalali" ? parseInt(formatJalaliDate(now, "yyyy"), 10) : now.getFullYear();

    const rows = await tx.$queryRaw<{ last_serial: number }[]>`
      SELECT last_serial FROM letter_counters WHERE year = ${year} AND our_entity_id = ${ourEntityId}::uuid FOR UPDATE
    `;

    let serial: number;
    if (rows.length === 0) {
      serial = 1;
      await tx.$executeRaw`INSERT INTO letter_counters (year, our_entity_id, last_serial) VALUES (${year}, ${ourEntityId}::uuid, 1)`;
    } else {
      serial = rows[0].last_serial + 1;
      await tx.$executeRaw`UPDATE letter_counters SET last_serial = ${serial} WHERE year = ${year} AND our_entity_id = ${ourEntityId}::uuid`;
    }

    return `${year}-${shortCode}-${String(serial).padStart(4, "0")}`;
  }
}
