import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";

/** FRT-<سال میلادی>-<سریال ۴ رقمی> — اتمیک، همون الگوی RfqNumberService */
@Injectable()
export class FreightRfqNumberService {
  async nextNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
    const year = now.getFullYear();

    const rows = await tx.$queryRaw<{ last_serial: number }[]>`
      SELECT last_serial FROM freight_rfq_counters WHERE year = ${year} FOR UPDATE
    `;

    let serial: number;
    if (rows.length === 0) {
      serial = 1;
      await tx.$executeRaw`INSERT INTO freight_rfq_counters (year, last_serial) VALUES (${year}, 1)`;
    } else {
      serial = rows[0].last_serial + 1;
      await tx.$executeRaw`UPDATE freight_rfq_counters SET last_serial = ${serial} WHERE year = ${year}`;
    }

    return `FRT-${year}-${String(serial).padStart(4, "0")}`;
  }
}
