import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from "class-validator";
import { ACTIVITY_TYPES } from "./activity.dto";

// اثر ثبت این نتیجه روی Task — close=بستن، create_follow_up=پیگیری (پیش‌فرض
// همون Task با سررسید جدید)، keep_waiting=انتقال به وضعیت انتظار
export const OUTCOME_EFFECTS = ["close", "create_follow_up", "keep_waiting"] as const;

export class CreateOutcomeTemplateDto {
  @IsIn(ACTIVITY_TYPES, { message: "نوع فعالیت نامعتبره" })
  activityType!: (typeof ACTIVITY_TYPES)[number];

  @IsString()
  @MinLength(1, { message: "عنوان نتیجه الزامیه" })
  label!: string;

  @IsOptional()
  @IsIn(OUTCOME_EFFECTS, { message: "اثر نتیجه نامعتبره" })
  effect?: (typeof OUTCOME_EFFECTS)[number];

  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;

  @IsOptional()
  @IsIn(ACTIVITY_TYPES, { message: "نوع فعالیت پیگیری نامعتبره" })
  followUpActivityType?: (typeof ACTIVITY_TYPES)[number];

  @ValidateIf((dto) => dto.effect === "create_follow_up")
  @IsInt({ message: "فاصلهٔ پیش‌فرض پیگیری (به دقیقه) برای نتایج پیگیری‌دار الزامیه" })
  @Min(1)
  followUpOffsetMinutes?: number;
}

export class UpdateOutcomeTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsIn(OUTCOME_EFFECTS, { message: "اثر نتیجه نامعتبره" })
  effect?: (typeof OUTCOME_EFFECTS)[number];

  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;

  @IsOptional()
  @IsIn(ACTIVITY_TYPES, { message: "نوع فعالیت پیگیری نامعتبره" })
  followUpActivityType?: (typeof ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  followUpOffsetMinutes?: number;
}
