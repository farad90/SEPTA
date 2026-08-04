import { ProposalNumberService } from "./proposal-number.service";
import { AtomicCounterService } from "../common/atomic-counter/atomic-counter.service";

function buildTx(existingSerial: number | null, buyer: { shortCodeEn: string | null; companyNameEn: string | null }) {
  return {
    inquiry: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ buyerId: "buyer-1" }),
    },
    businessPartner: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(buyer),
    },
    $queryRaw: jest.fn().mockResolvedValue(existingSerial === null ? [] : [{ last_serial: existingSerial }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
  };
}

describe("ProposalNumberService — شماره‌گذاری بر مبنای سال + کد اختصاری مشتری (فاز ۵۱)", () => {
  it("uses the buyer's manual short code when set, for the first proposal of the year", async () => {
    const service = new ProposalNumberService(new AtomicCounterService());
    const tx = buildTx(null, { shortCodeEn: "GT", companyNameEn: "General Trading srl" });
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "inquiry-1", now);

    expect(number).toBe("2026-GT-0001");
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("increments the existing serial instead of restarting at 1", async () => {
    const service = new ProposalNumberService(new AtomicCounterService());
    const tx = buildTx(6, { shortCodeEn: "GT", companyNameEn: null });
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "inquiry-1", now);

    expect(number).toBe("2026-GT-0007");
  });

  it("derives the code from companyNameEn initials when no manual short code is set", async () => {
    const service = new ProposalNumberService(new AtomicCounterService());
    const tx = buildTx(null, { shortCodeEn: null, companyNameEn: "Pasifik Global Makina" });
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "inquiry-1", now);

    expect(number).toBe("2026-PGM-0001");
  });

  it("falls back to a generic code when neither short code nor English name exist", async () => {
    const service = new ProposalNumberService(new AtomicCounterService());
    const tx = buildTx(null, { shortCodeEn: null, companyNameEn: null });
    const now = new Date("2026-07-10T10:00:00Z");

    const number = await service.nextNumber(tx as never, "inquiry-1", now);

    expect(number).toBe("2026-CLIENT-0001");
  });

  it("uses a separate counter per calendar year", async () => {
    const service = new ProposalNumberService(new AtomicCounterService());
    const tx = buildTx(null, { shortCodeEn: "GT", companyNameEn: null });
    const now = new Date("2027-01-05T10:00:00Z");

    const number = await service.nextNumber(tx as never, "inquiry-1", now);

    expect(number).toBe("2027-GT-0001");
  });
});
