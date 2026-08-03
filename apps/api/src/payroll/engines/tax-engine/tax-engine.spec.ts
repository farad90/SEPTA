import { RuleSet, TaxBracket } from "../rule-engine/rule-set.types";
import { TaxEngineService } from "./tax-engine.service";

function bracket(order: number, from: number, to: number | null, rate: number): TaxBracket {
  return { bracketOrder: order, fromAmount: from, toAmount: to, ratePercent: rate };
}

function ruleSet(values: Record<string, number>, brackets: TaxBracket[] = []): RuleSet {
  return { ruleVersionId: "v1", values, brackets };
}

describe("TaxEngineService", () => {
  const service = new TaxEngineService();

  it("بدون تعریف پله، مالیات صفر است", () => {
    expect(service.calculate(10_000_000, ruleSet({}))).toBe(0);
  });

  it("درآمد زیر سقف معافیت، مالیات صفر می‌گیرد", () => {
    const result = service.calculate(
      5_000_000,
      ruleSet({ TAX_EXEMPTION: 10_000_000 }, [bracket(1, 0, null, 10)]),
    );
    expect(result).toBe(0);
  });

  it("مالیات پلکانی را روی چند پله به‌درستی محاسبه می‌کند", () => {
    // معافیت ۱۰ میلیون؛ پله ۱: ۰ تا ۱۰ میلیون @ ۱۰٪؛ پله ۲: ۱۰ به بالا @ ۲۰٪
    // درآمد مشمول = ۳۰ - ۱۰ = ۲۰ میلیون → پله ۱: ۱۰م×۱۰٪=۱م ، پله ۲: ۱۰م×۲۰٪=۲م → جمع ۳م
    const rules = ruleSet({ TAX_EXEMPTION: 10_000_000 }, [
      bracket(1, 0, 10_000_000, 10),
      bracket(2, 10_000_000, null, 20),
    ]);
    expect(service.calculate(30_000_000, rules)).toBeCloseTo(3_000_000);
  });

  it("ترتیب پله‌ها مستقل از ترتیب آرایه‌ی ورودی، طبق bracketOrder اعمال می‌شود", () => {
    const rules = ruleSet({ TAX_EXEMPTION: 0 }, [
      bracket(2, 5_000_000, null, 20),
      bracket(1, 0, 5_000_000, 10),
    ]);
    // درآمد ۸م → پله۱: ۵م×۱۰٪=۵۰۰هزار، پله۲: ۳م×۲۰٪=۶۰۰هزار → ۱.۱م
    expect(service.calculate(8_000_000, rules)).toBeCloseTo(1_100_000);
  });

  it("آخرین پله بدون toAmount تا بی‌نهایت باز است", () => {
    const rules = ruleSet({ TAX_EXEMPTION: 0 }, [bracket(1, 0, null, 15)]);
    expect(service.calculate(100_000_000, rules)).toBeCloseTo(15_000_000);
  });

  it("درآمد مشمول صفر یا منفی، مالیات صفر می‌دهد", () => {
    const rules = ruleSet({ TAX_EXEMPTION: 10_000_000 }, [bracket(1, 0, null, 10)]);
    expect(service.calculate(0, rules)).toBe(0);
    expect(service.calculate(-500_000, rules)).toBe(0);
  });
});
