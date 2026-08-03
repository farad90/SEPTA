import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

const ZERO_WORKLOG_INPUTS = {
  WORKED_DAYS: 0,
  OVERTIME_HOURS: 0,
  NIGHT_HOURS: 0,
  FRIDAY_HOURS: 0,
  HOLIDAY_HOURS: 0,
  MISSION_DAYS: 0,
  LEAVE_DAYS: 0,
  ABSENCE_DAYS: 0,
  LATENESS_MINUTES: 0,
  EARLY_LEAVE_MINUTES: 0,
  REQUIRED_HOURS: 0,
  WORKED_HOURS: 0,
};

/**
 * مرحله ۳: بارگذاری PayrollWorkLog از قبل تجمیع‌شده (توسط WorkLogAggregatorService، جدا از
 * این Pipeline اجرا می‌شود — نگاه کنید به تصمیم تأییدشده §00-ب). اگر هنوز تجمیع نشده باشد،
 * محافظه‌کارانه صفر فرض می‌شود تا محاسبه بلوکه نشود.
 */
@Injectable()
export class LoadWorkLogStage implements PayrollPipelineStage {
  readonly name = "load_worklog";

  constructor(private readonly prisma: PrismaService) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    const workLog = await this.prisma.payrollWorkLog.findUnique({
      where: {
        payrollPeriodId_employeeId: { payrollPeriodId: ctx.payrollPeriodId, employeeId: ctx.employeeId },
      },
    });

    ctx.workLogInputs = workLog
      ? {
          WORKED_DAYS: Number(workLog.workedDays),
          OVERTIME_HOURS: Number(workLog.overtimeHours),
          NIGHT_HOURS: Number(workLog.nightHours),
          FRIDAY_HOURS: Number(workLog.fridayHours),
          HOLIDAY_HOURS: Number(workLog.holidayHours),
          MISSION_DAYS: Number(workLog.missionDays),
          LEAVE_DAYS: Number(workLog.leaveDays),
          ABSENCE_DAYS: Number(workLog.absenceDays),
          LATENESS_MINUTES: workLog.latenessMinutes,
          EARLY_LEAVE_MINUTES: workLog.earlyLeaveMinutes,
          REQUIRED_HOURS: Number(workLog.requiredHours),
          WORKED_HOURS: Number(workLog.workedHours),
        }
      : { ...ZERO_WORKLOG_INPUTS };
  }
}
