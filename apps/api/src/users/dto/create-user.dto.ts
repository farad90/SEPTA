import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

/** ساخت سریع کاربر توسط مدیر (NewUserQuick در mockup) — برخلاف register، مستقیم گروه می‌گیره */
export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: "نام و نام خانوادگی الزامیه" })
  fullName!: string;

  @IsOptional()
  @Matches(/^09\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  mobile?: string;

  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "رمز عبور اولیه باید حداقل ۸ کاراکتر باشه" })
  initialPassword!: string;

  @IsUUID()
  permissionGroupId!: string;
}
