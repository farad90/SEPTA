import { Prisma } from "../../generated/prisma";
import { InquiryNumberService } from "./inquiry-number.service";
import { AtomicCounterService } from "../common/atomic-counter/atomic-counter.service";

function buildTx(existingSerial: number | null) {
  return {
    $queryRaw: jest
      .fn()
      .mockResolvedValue(existingSerial === null ? [] : [{ last_serial: existingSerial }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  } as unknown as Prisma.TransactionClient;
}

describe("InquiryNumberService", () => {
  it("starts a new year at serial 0001 with the Gregorian year", async () => {
    const tx = buildTx(null);
    const service = new InquiryNumberService(new AtomicCounterService());

    const number = await service.nextNumber(tx, new Date("2026-07-08"));

    expect(number).toBe("INQ-2026-0001");
    expect((tx.$executeRaw as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("increments the existing counter", async () => {
    const tx = buildTx(416);
    const service = new InquiryNumberService(new AtomicCounterService());

    const number = await service.nextNumber(tx, new Date("2026-03-01"));

    expect(number).toBe("INQ-2026-0417");
  });

  it("pads serials to four digits and rolls with the year", async () => {
    const service = new InquiryNumberService(new AtomicCounterService());

    await expect(service.nextNumber(buildTx(8), new Date("2027-01-01"))).resolves.toBe(
      "INQ-2027-0009",
    );
  });
});
