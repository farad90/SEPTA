import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RuleEngineService } from "../../engines/rule-engine/rule-engine.service";
import { PayrollPeriodNotFoundError } from "../errors";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۱: بارگذاری دوره + نسخه‌ی قانون معتبرِ ثابت‌شده‌ی همان دوره (Rule Engine). */
@Injectable()
export class LoadRulesStage implements PayrollPipelineStage {
  readonly name = "load_rules";

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: ctx.payrollPeriodId },
      include: { payrollYear: true },
    });
    if (!period) throw new PayrollPeriodNotFoundError(ctx.payrollPeriodId);

    ctx.period = {
      id: period.id,
      monthNumber: period.monthNumber,
      yearNumber: period.payrollYear.yearNumber,
      calendarType: period.payrollYear.calendarType,
      ruleVersionId: period.ruleVersionId,
    };
    ctx.ruleSet = await this.ruleEngine.loadByVersion(period.ruleVersionId);
  }
}
