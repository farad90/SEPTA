import { AtomicCounterService } from "./atomic-counter.service";

describe("AtomicCounterService", () => {
  let tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let service: AtomicCounterService;

  beforeEach(() => {
    tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    service = new AtomicCounterService();
  });

  it("starts a new counter at 1 and inserts a row when none exists yet", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.$executeRaw.mockResolvedValue(1);

    const serial = await service.next(tx as any, "inquiry_counters", [{ column: "year", value: 2026 }]);

    expect(serial).toBe(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const insertSql = tx.$executeRaw.mock.calls[0][0];
    expect(insertSql.sql).toContain("INSERT INTO inquiry_counters");
    expect(insertSql.sql).toContain("year");
    expect(insertSql.values).toEqual(expect.arrayContaining([2026]));
  });

  it("increments an existing counter's last_serial", async () => {
    tx.$queryRaw.mockResolvedValue([{ last_serial: 7 }]);
    tx.$executeRaw.mockResolvedValue(1);

    const serial = await service.next(tx as any, "rfq_counters", [{ column: "year", value: 2026 }]);

    expect(serial).toBe(8);
    const updateSql = tx.$executeRaw.mock.calls[0][0];
    expect(updateSql.sql).toContain("UPDATE rfq_counters");
    expect(updateSql.sql).toContain("SET last_serial");
    expect(updateSql.values).toEqual(expect.arrayContaining([8, 2026]));
  });

  it("builds a composite-key WHERE clause with an ::uuid cast when requested", async () => {
    tx.$queryRaw.mockResolvedValue([{ last_serial: 3 }]);
    tx.$executeRaw.mockResolvedValue(1);

    await service.next(tx as any, "letter_counters", [
      { column: "year", value: 1405 },
      { column: "our_entity_id", value: "11111111-1111-1111-1111-111111111111", isUuid: true },
    ]);

    const selectSql = tx.$queryRaw.mock.calls[0][0];
    expect(selectSql.sql).toContain("year");
    expect(selectSql.sql).toContain("our_entity_id");
    expect(selectSql.sql).toContain("::uuid");
    expect(selectSql.sql).toContain(" AND ");
    expect(selectSql.values).toEqual(
      expect.arrayContaining([1405, "11111111-1111-1111-1111-111111111111"]),
    );
  });

  it("selects with FOR UPDATE to serialize concurrent callers", async () => {
    tx.$queryRaw.mockResolvedValue([{ last_serial: 1 }]);
    tx.$executeRaw.mockResolvedValue(1);

    await service.next(tx as any, "shipment_counters", [{ column: "year", value: 2026 }]);

    const selectSql = tx.$queryRaw.mock.calls[0][0];
    expect(selectSql.sql).toContain("FOR UPDATE");
  });
});
