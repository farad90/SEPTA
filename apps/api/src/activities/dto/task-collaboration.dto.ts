import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { OUTCOME_EFFECTS } from "./outcome-template.dto";

export class AddCommentDto {
  @IsString()
  @MinLength(1, { message: "متن کامنت الزامیه" })
  text!: string;
}

export class ReassignTaskDto {
  @IsUUID(undefined, { message: "مسئول جدید نامعتبره" })
  newOwnerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AddWatcherDto {
  @IsUUID(undefined, { message: "کاربر نامعتبره" })
  userId!: string;
}

export class RecordOutcomeDto {
  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  @IsOptional()
  @IsString()
  outcomeNote?: string;

  // برای اقدامات سریع از داخل لیست (مثلاً «موکول کن») که بدون انتخاب یک قالب نتیجهٔ
  // مشخص، فقط می‌خوان اثر رو صراحتاً تعیین کنن — وقتی پر باشه، به effect قالب اولویت داره
  @IsOptional()
  @IsIn(OUTCOME_EFFECTS, { message: "اثر نتیجه نامعتبره" })
  effectOverride?: (typeof OUTCOME_EFFECTS)[number];

  // سررسید/اقدام بعدی — وقتی اثر نتیجه create_follow_up باشه لازمه (چه همون Task
  // ادامه پیدا کنه چه Task مستقل جدید ساخته بشه)
  @IsOptional()
  @IsDateString()
  nextActionAt?: string;

  // پیش‌فرض false: همون Task باز می‌مونه، فقط سررسید/اقدام بعدی عوض می‌شه.
  // true فقط وقتی کاربر صراحتاً می‌خواد یک Task کاملاً مستقل و جدا ساخته بشه
  @IsOptional()
  @IsBoolean()
  spawnNewTask?: boolean;
}
