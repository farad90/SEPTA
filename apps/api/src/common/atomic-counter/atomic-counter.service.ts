import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma";

export interface CounterKey {
  /** Column name — always a hardcoded literal at call sites, never user input. */
  column: string;
  value: string | number;
  /** Set for UUID key columns (e.g. our_entity_id) so the value casts correctly. */
  isUuid?: boolean;
}

/**
 * P1-E5-F1-T1 — the single SELECT...FOR UPDATE-then-upsert atomic-counter
 * pattern that used to be copy-pasted six times (inquiry/rfq/freight-rfq/
 * shipment/letter/proposal number services), each with its own hand-rolled
 * raw SQL. Behavior is unchanged from those six originals — this is a pure
 * extraction, not a redesign.
 *
 * Must be called inside the same transaction as whatever consumes the
 * returned serial, so a failed creation doesn't burn a number.
 *
 * Table and column names are passed by trusted, hardcoded call sites only
 * (never derived from user input) — Prisma.raw() is the correct tool for
 * that (Prisma's tagged-template $queryRaw can only safely parameterize
 * VALUES, not identifiers). Every runtime VALUE still goes through Prisma's
 * safe parameterization, same as the six originals did.
 */
@Injectable()
export class AtomicCounterService {
  async next(tx: Prisma.TransactionClient, table: string, keys: CounterKey[]): Promise<number> {
    const whereClause = Prisma.join(
      keys.map((k) => Prisma.sql`${Prisma.raw(k.column)} = ${k.value}${Prisma.raw(k.isUuid ? "::uuid" : "")}`),
      " AND ",
    );

    const rows = await tx.$queryRaw<{ last_serial: number }[]>(
      Prisma.sql`SELECT last_serial FROM ${Prisma.raw(table)} WHERE ${whereClause} FOR UPDATE`,
    );

    if (rows.length === 0) {
      const insertColumns = Prisma.raw(keys.map((k) => k.column).join(", "));
      const insertValues = Prisma.join(
        keys.map((k) => Prisma.sql`${k.value}${Prisma.raw(k.isUuid ? "::uuid" : "")}`),
        ", ",
      );
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO ${Prisma.raw(table)} (${insertColumns}, last_serial) VALUES (${insertValues}, 1)`,
      );
      return 1;
    }

    const serial = rows[0].last_serial + 1;
    await tx.$executeRaw(Prisma.sql`UPDATE ${Prisma.raw(table)} SET last_serial = ${serial} WHERE ${whereClause}`);
    return serial;
  }
}
