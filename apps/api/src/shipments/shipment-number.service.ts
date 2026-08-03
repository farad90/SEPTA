import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";

/** SHP-<سال میلادی>-<سریال ۴ رقمی> — اتمیک، همون الگوی RfqNumberService */
@Injectable()
export class ShipmentNumberService {
  async nextNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
    const year = now.getFullYear();

    const rows = await tx.$queryRaw<{ last_serial: number }[]>`
      SELECT last_serial FROM shipment_counters WHERE year = ${year} FOR UPDATE
    `;

    let serial: number;
    if (rows.length === 0) {
      serial = 1;
      await tx.$executeRaw`INSERT INTO shipment_counters (year, last_serial) VALUES (${year}, 1)`;
    } else {
      serial = rows[0].last_serial + 1;
      await tx.$executeRaw`UPDATE shipment_counters SET last_serial = ${serial} WHERE year = ${year}`;
    }

    return `SHP-${year}-${String(serial).padStart(4, "0")}`;
  }
}
