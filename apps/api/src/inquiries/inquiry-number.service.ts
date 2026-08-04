import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AtomicCounterService } from "../common/atomic-counter/atomic-counter.service";

/**
 * تولید اتمیک شماره داخلی استعلام: INQ-<سال میلادی>-<سریال ۴ رقمی>
 * باید داخل همون تراکنشی صدا زده بشه که استعلام رو می‌سازه (tx پاس داده می‌شه)
 * تا اگه ساخت شکست خورد، شماره هم مصرف نشه.
 *
 * P1-E5-F1-T1 — atomic increment logic moved to the shared
 * AtomicCounterService; this class now only owns the table name, key, and
 * INQ-{year}-{serial} format — behavior is unchanged.
 */
@Injectable()
export class InquiryNumberService {
  constructor(private readonly counter: AtomicCounterService) {}

  async nextNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
    const year = now.getFullYear();
    const serial = await this.counter.next(tx, "inquiry_counters", [{ column: "year", value: year }]);
    return `INQ-${year}-${String(serial).padStart(4, "0")}`;
  }
}
