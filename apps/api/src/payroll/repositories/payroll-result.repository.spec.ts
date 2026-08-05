import { PrismaService } from "../../prisma/prisma.service";
import { PayrollResultRepository } from "./payroll-result.repository";

function buildPrisma() {
  const prisma: any = {
    payrollResult: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    payrollResultItem: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  return prisma;
}

function buildRepo(prisma: ReturnType<typeof buildPrisma>) {
  return new PayrollResultRepository(prisma as unknown as PrismaService);
}

const TOTALS = {
  grossEarnings: 1000,
  totalDeductions: 200,
  insuranceEmployeeShare: 70,
  insuranceEmployerShare: 230,
  unemploymentInsurance: 30,
  taxAmount: 100,
  netSalary: 800,
  employerCost: 1230,
};

const ITEMS = [
  { componentId: "c1", componentCode: "BASE", amount: 1000, calcOrder: 1, formulaSnapshot: null },
];

describe("PayrollResultRepository.saveResult", () => {
  it("رکورد جدید می‌سازد وقتی نتیجه‌ای برای این دوره/کارمند وجود ندارد", async () => {
    const prisma = buildPrisma();
    prisma.payrollResult.findUnique.mockResolvedValue(null);
    prisma.payrollResult.create.mockResolvedValue({ id: "result-1" });
    const repo = buildRepo(prisma);

    const result = await repo.saveResult("period-1", "emp-1", TOTALS, ITEMS);

    expect(prisma.payrollResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payrollPeriodId: "period-1",
        employeeId: "emp-1",
        status: "calculated",
        ...TOTALS,
      }),
    });
    expect(prisma.payrollResult.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "result-1" });
  });

  it("رکورد موجود را به‌روزرسانی می‌کند، نه دوباره create", async () => {
    const prisma = buildPrisma();
    prisma.payrollResult.findUnique.mockResolvedValue({ id: "result-1" });
    prisma.payrollResult.update.mockResolvedValue({ id: "result-1" });
    const repo = buildRepo(prisma);

    await repo.saveResult("period-1", "emp-1", TOTALS, ITEMS);

    expect(prisma.payrollResult.create).not.toHaveBeenCalled();
    expect(prisma.payrollResult.update).toHaveBeenCalledWith({
      where: { id: "result-1" },
      data: expect.objectContaining({ status: "calculated", ...TOTALS }),
    });
  });

  it("همیشه ابتدا ردیف‌های قدیمی اجزا را پاک و سپس ردیف‌های تازه را می‌سازد", async () => {
    const prisma = buildPrisma();
    prisma.payrollResult.findUnique.mockResolvedValue({ id: "result-1" });
    prisma.payrollResult.update.mockResolvedValue({ id: "result-1" });
    const repo = buildRepo(prisma);

    await repo.saveResult("period-1", "emp-1", TOTALS, ITEMS);

    expect(prisma.payrollResultItem.deleteMany).toHaveBeenCalledWith({
      where: { payrollResultId: "result-1" },
    });
    expect(prisma.payrollResultItem.createMany).toHaveBeenCalledWith({
      data: [{ payrollResultId: "result-1", ...ITEMS[0] }],
    });
  });

  it("وقتی آرایه‌ی اجزا خالی است، createMany صدا زده نمی‌شود (فقط deleteMany)", async () => {
    const prisma = buildPrisma();
    prisma.payrollResult.findUnique.mockResolvedValue({ id: "result-1" });
    prisma.payrollResult.update.mockResolvedValue({ id: "result-1" });
    const repo = buildRepo(prisma);

    await repo.saveResult("period-1", "emp-1", TOTALS, []);

    expect(prisma.payrollResultItem.deleteMany).toHaveBeenCalled();
    expect(prisma.payrollResultItem.createMany).not.toHaveBeenCalled();
  });

  it("در صورت پاس‌دادن یک tx، از همان client تراکنشی استفاده می‌کند نه this.prisma", async () => {
    const prisma = buildPrisma();
    const tx: any = {
      payrollResult: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "r2" }) },
      payrollResultItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const repo = buildRepo(prisma);

    await repo.saveResult("period-1", "emp-1", TOTALS, ITEMS, tx);

    expect(tx.payrollResult.findUnique).toHaveBeenCalled();
    expect(prisma.payrollResult.findUnique).not.toHaveBeenCalled();
  });
});

// P0-E4-F1-T1
describe("PayrollResultRepository.updateStatus", () => {
  it("وقتی status ردیف با expectedCurrentStatus مطابقت داره، آپدیت اتمی انجام و ردیف تازه برگردونده می‌شه", async () => {
    const prisma = buildPrisma();
    prisma.payrollResult.updateMany.mockResolvedValue({ count: 1 });
    prisma.payrollResult.findUnique.mockResolvedValue({ id: "r1", status: "reviewed" });
    const repo = buildRepo(prisma);

    const result = await repo.updateStatus("r1", "reviewed", "u1", "reviewedAt", "reviewedBy", "calculated");

    expect(prisma.payrollResult.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "calculated" },
      data: { status: "reviewed", reviewedAt: expect.any(Date), reviewedBy: "u1" },
    });
    expect(result).toEqual({ id: "r1", status: "reviewed" });
  });

  it("وقتی یک عملیات هم‌زمان دیگه اول status رو عوض کرده (WHERE هیچ ردیفی رو نمی‌گیره)، null برمی‌گردونه — نه خطا، نه آپدیت خاموش", async () => {
    const prisma = buildPrisma();
    prisma.payrollResult.updateMany.mockResolvedValue({ count: 0 });
    const repo = buildRepo(prisma);

    const result = await repo.updateStatus("r1", "reviewed", "u1", "reviewedAt", "reviewedBy", "calculated");

    expect(result).toBeNull();
    // شکست تشخیص داده شد و اونجا متوقف شد — هیچ تلاشی برای خوندن/برگردوندن ردیف نشد
    expect(prisma.payrollResult.findUnique).not.toHaveBeenCalled();
  });
});
