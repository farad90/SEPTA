import { IsEmail, IsIn, IsString, Matches, MinLength } from "class-validator";

const DEPARTMENTS = ["فروش", "بازرگانی", "مالی", "مدیریت"] as const;

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: "نام و نام خانوادگی الزامیه" })
  fullName!: string;

  @Matches(/^09\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  mobile!: string;

  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email!: string;

  @IsIn(DEPARTMENTS, { message: "واحد سازمانی نامعتبره" })
  department!: (typeof DEPARTMENTS)[number];

  @IsString()
  @MinLength(8, { message: "رمز عبور باید حداقل ۸ کاراکتر باشه" })
  password!: string;
}
