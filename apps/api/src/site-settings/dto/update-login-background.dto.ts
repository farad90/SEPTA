import { IsOptional, IsString } from "class-validator";

export class UpdateLoginBackgroundDto {
  // مقدار null یعنی بازگردانی به پیش‌فرض (حذف تصویر پس‌زمینه)
  @IsOptional()
  @IsString()
  loginBackgroundUrl?: string | null;
}
