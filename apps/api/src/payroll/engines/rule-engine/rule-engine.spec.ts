import { PrismaService } from "../../../prisma/prisma.service";
import { RuleVersionNotFoundError } from "./errors";
import { RuleEngineService } from "./rule-engine.service";

function buildPrisma() {
  const prisma: any = {
    payrollRuleVersion: { findUnique: jest.fn() },
  };
  return prisma;
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new RuleEngineService(prisma as unknown as PrismaService);
}

const VERSION_ROW = {
  id: "v1",
  rules: [
    { code: "INSURANCE_RATE_EMPLOYEE", value: "7" },
    { code: "INSURANCE_RATE_EMPLOYER", value: "23" },
  ],
  brackets: [
    { bracketOrder: 2, fromAmount: "10000000", toAmount: null, ratePercent: "20" },
    { bracketOrder: 1, fromAmount: "0", toAmount: "10000000", ratePercent: "10" },
  ],
};

describe("RuleEngineService.loadByVersion", () => {
  it("یک نسخه‌ی قانون را به RuleSet تبدیل می‌کند (مقادیر Decimal → number)", async () => {
    const prisma = buildPrisma();
    prisma.payrollRuleVersion.findUnique.mockResolvedValue(VERSION_ROW);
    const service = buildService(prisma);

    const ruleSet = await service.loadByVersion("v1");

    expect(ruleSet.ruleVersionId).toBe("v1");
    expect(ruleSet.values).toEqual({
      INSURANCE_RATE_EMPLOYEE: 7,
      INSURANCE_RATE_EMPLOYER: 23,
    });
    expect(ruleSet.brackets).toEqual([
      { bracketOrder: 2, fromAmount: 10_000_000, toAmount: null, ratePercent: 20 },
      { bracketOrder: 1, fromAmount: 0, toAmount: 10_000_000, ratePercent: 10 },
    ]);
  });

  it("درخواست را دقیقاً با ruleVersionId داده‌شده به Prisma پاس می‌دهد", async () => {
    const prisma = buildPrisma();
    prisma.payrollRuleVersion.findUnique.mockResolvedValue(VERSION_ROW);
    const service = buildService(prisma);

    await service.loadByVersion("v1");

    expect(prisma.payrollRuleVersion.findUnique).toHaveBeenCalledWith({
      where: { id: "v1" },
      include: { rules: true, brackets: { orderBy: { bracketOrder: "asc" } } },
    });
  });

  it("وقتی نسخه پیدا نشود، RuleVersionNotFoundError پرتاب می‌کند", async () => {
    const prisma = buildPrisma();
    prisma.payrollRuleVersion.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.loadByVersion("missing")).rejects.toBeInstanceOf(RuleVersionNotFoundError);
  });

  it("نتیجه را کش می‌کند — فراخوانی دوم دیگر به Prisma نمی‌رود", async () => {
    const prisma = buildPrisma();
    prisma.payrollRuleVersion.findUnique.mockResolvedValue(VERSION_ROW);
    const service = buildService(prisma);

    await service.loadByVersion("v1");
    await service.loadByVersion("v1");

    expect(prisma.payrollRuleVersion.findUnique).toHaveBeenCalledTimes(1);
  });

  it("invalidate کش را پاک می‌کند و فراخوانی بعدی دوباره از Prisma می‌خواند", async () => {
    const prisma = buildPrisma();
    prisma.payrollRuleVersion.findUnique.mockResolvedValue(VERSION_ROW);
    const service = buildService(prisma);

    await service.loadByVersion("v1");
    service.invalidate("v1");
    await service.loadByVersion("v1");

    expect(prisma.payrollRuleVersion.findUnique).toHaveBeenCalledTimes(2);
  });

  it("دو نسخه‌ی متفاوت را مستقل کش می‌کند", async () => {
    const prisma = buildPrisma();
    prisma.payrollRuleVersion.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ ...VERSION_ROW, id: where.id }),
    );
    const service = buildService(prisma);

    const a = await service.loadByVersion("v1");
    const b = await service.loadByVersion("v2");

    expect(a.ruleVersionId).toBe("v1");
    expect(b.ruleVersionId).toBe("v2");
    expect(prisma.payrollRuleVersion.findUnique).toHaveBeenCalledTimes(2);
  });
});
