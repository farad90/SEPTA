import { LetterNumberService } from "./letter-number.service";

function buildTx(existingSerial: number | null) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(existingSerial === null ? [] : [{ last_serial: existingSerial }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
  };
}

describe("LetterNumberService — شماره‌گذاری بر مبنای شرکت گروه صادرکننده", () => {
  it("uses the Jalali year for a calendar_type='jalali' entity", async () => {
    const service = new LetterNumberService();
    const tx = buildTx(null);
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "entity-1", "jalali", "پ ت", now);

    expect(number).toBe("1405-پ ت-0001");
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("uses the Gregorian year for a calendar_type='gregorian' entity", async () => {
    const service = new LetterNumberService();
    const tx = buildTx(null);
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "entity-2", "gregorian", "GT", now);

    expect(number).toBe("2026-GT-0001");
  });

  it("increments the existing serial instead of restarting at 1", async () => {
    const service = new LetterNumberService();
    const tx = buildTx(41);
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "entity-1", "jalali", "پ ت", now);

    expect(number).toBe("1405-پ ت-0042");
  });
});
