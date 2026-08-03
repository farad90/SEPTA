import { PayrollResultRepository } from "../../repositories/payroll-result.repository";
import { PayrollResultLockedError } from "../../workflow/errors";
import { PayrollPipelineContext } from "../pipeline-context";
import { StoreResultStage } from "./13-store-result.stage";

function buildRepository() {
  return {
    findByPeriodAndEmployee: jest.fn(),
    saveResult: jest.fn(),
  } as unknown as jest.Mocked<PayrollResultRepository>;
}

function baseCtx(): PayrollPipelineContext {
  return {
    payrollPeriodId: "period-1",
    employeeId: "emp-1",
    componentResults: [
      {
        componentId: "c1",
        code: "BASE",
        componentType: "earning",
        isInsurable: true,
        isTaxable: true,
        calcOrder: 1,
        amount: 1000,
        formulaSnapshot: "BASE_SALARY",
      },
      {
        componentId: "c2",
        code: "INSURANCE",
        componentType: "deduction",
        isInsurable: false,
        isTaxable: false,
        calcOrder: 2,
        amount: 0,
        formulaSnapshot: null,
      },
    ],
    grossEarnings: 1000,
    insuranceResult: { insuranceBase: 1000, employeeShare: 70, employerShare: 230, unemploymentShare: 30, total: 330 },
    taxAmount: 50,
    otherDeductions: 0,
    netSalary: 880,
    employerCost: 1260,
  };
}

describe("StoreResultStage", () => {
  it("وقتی نتیجه‌ی موجود این کارمند/دوره Locked باشد، PayrollResultLockedError می‌دهد و saveResult صدا زده نمی‌شود", async () => {
    const repository = buildRepository();
    (repository.findByPeriodAndEmployee as jest.Mock).mockResolvedValue({ id: "old-result", status: "locked" });
    const stage = new StoreResultStage(repository);

    await expect(stage.execute(baseCtx())).rejects.toBeInstanceOf(PayrollResultLockedError);
    expect(repository.saveResult).not.toHaveBeenCalled();
  });

  it("وقتی نتیجه‌ی موجود Locked نباشد، عادی ذخیره می‌کند", async () => {
    const repository = buildRepository();
    (repository.findByPeriodAndEmployee as jest.Mock).mockResolvedValue({ id: "old-result", status: "approved" });
    (repository.saveResult as jest.Mock).mockResolvedValue({ id: "result-1" });
    const stage = new StoreResultStage(repository);

    const ctx = baseCtx();
    await stage.execute(ctx);

    expect(repository.saveResult).toHaveBeenCalled();
    expect(ctx.savedResultId).toBe("result-1");
  });

  it("کد INSURANCE/TAX را از PayrollResultItem های ذخیره‌شده کنار می‌گذارد", async () => {
    const repository = buildRepository();
    (repository.findByPeriodAndEmployee as jest.Mock).mockResolvedValue(null);
    (repository.saveResult as jest.Mock).mockResolvedValue({ id: "result-1" });
    const stage = new StoreResultStage(repository);

    await stage.execute(baseCtx());

    const [, , , items] = (repository.saveResult as jest.Mock).mock.calls[0];
    expect(items.map((i: { componentCode: string }) => i.componentCode)).toEqual(["BASE"]);
  });

  it("وقتی رکورد قبلی وجود ندارد، بدون خطا ادامه می‌دهد", async () => {
    const repository = buildRepository();
    (repository.findByPeriodAndEmployee as jest.Mock).mockResolvedValue(null);
    (repository.saveResult as jest.Mock).mockResolvedValue({ id: "result-1" });
    const stage = new StoreResultStage(repository);

    await expect(stage.execute(baseCtx())).resolves.toBeUndefined();
  });
});
