import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";

/**
 * تولید اتمیک شماره داخلی استعلام: INQ-<سال میلادی>-<سریال ۴ رقمی>
 * باید داخل همون تراکنشی صدا زده بشه که استعلام رو می‌سازه (tx پاس داده می‌شه)
 * تا اگه ساخت شکست خورد، شماره هم مصرف نشه.
 */
@Injectable()
export class InquiryNumberService {
  async nextNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
    const year = now.getFullYear();

    // SELECT ... FOR UPDATE — دو درخواست هم‌زمان یک شماره نمی‌گیرن (قانون design doc)
    const rows = await tx.$queryRaw<{ last_serial: number }[]>`
      SELECT last_serial FROM inquiry_counters WHERE year = ${year} FOR UPDATE
    `;

    let serial: number;
    if (rows.length === 0) {
      serial = 1;
      await tx.$executeRaw`INSERT INTO inquiry_counters (year, last_serial) VALUES (${year}, 1)`;
    } else {
      serial = rows[0].last_serial + 1;
      await tx.$executeRaw`UPDATE inquiry_counters SET last_serial = ${serial} WHERE year = ${year}`;
    }

    return `INQ-${year}-${String(serial).padStart(4, "0")}`;
  }
}
