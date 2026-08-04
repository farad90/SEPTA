import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { AtomicCounterService } from "../common/atomic-counter/atomic-counter.service";

/**
 * SHP-<سال میلادی>-<سریال ۴ رقمی> — اتمیک، همون الگوی RfqNumberService.
 * P1-E5-F1-T1 — atomic increment logic moved to AtomicCounterService.
 */
@Injectable()
export class ShipmentNumberService {
  constructor(private readonly counter: AtomicCounterService) {}

  async nextNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
    const year = now.getFullYear();
    const serial = await this.counter.next(tx, "shipment_counters", [{ column: "year", value: year }]);
    return `SHP-${year}-${String(serial).padStart(4, "0")}`;
  }
}
