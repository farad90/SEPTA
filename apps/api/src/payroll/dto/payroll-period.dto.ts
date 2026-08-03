import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreatePayrollPeriodDto {
  @IsUUID()
  payrollYearId!: string;

  @IsString()
  @MinLength(1, { message: "کد دوره الزامیه" })
  @MaxLength(10, { message: "کد دوره حداکثر ۱۰ کاراکتر — مثلاً 1406-01" })
  periodCode!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  monthNumber!: number;

  @IsUUID()
  ruleVersionId!: string;
}

export class TransitionResultDto {
  @IsIn(["reviewed", "approved", "posted", "locked"])
  targetStatus!: "reviewed" | "approved" | "posted" | "locked";
}

export class ManualWorkLogDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  workedDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nightHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fridayHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  holidayHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  missionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leaveDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  absenceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  latenessMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  earlyLeaveMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  requiredHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  workedHours?: number;
}
