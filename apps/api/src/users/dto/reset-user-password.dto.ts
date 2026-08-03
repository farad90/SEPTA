import { IsString, MinLength } from "class-validator";

/** ریست پسورد یک کاربر توسط مدیر (users.manage) — هم‌الگوی initialPassword در CreateUserDto */
export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8, { message: "رمز عبور جدید باید حداقل ۸ کاراکتر باشه" })
  newPassword!: string;
}
