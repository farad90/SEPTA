import { IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from "class-validator";

export const GENDERS = ["male", "female"] as const;
export const MARITAL_STATUSES = ["single", "married"] as const;
export const MILITARY_SERVICE_STATUSES = ["completed", "exempt", "in_progress", "not_applicable"] as const;
export const EMPLOYMENT_STATUSES = ["active", "on_leave", "terminated"] as const;

export class CreateEmployeeDto {
  // ⚠️ فقط وقتی پرسنل حساب کاربری نداره (userId خالیه) الزامیه — در حالت «حساب کاربری دارد»،
  // این فیلد خالی می‌مونه تا بعداً با AssignEmployeeNumberDto تخصیص داده بشه
  @ValidateIf((o) => !o.userId)
  @IsString()
  @MinLength(1, { message: "شماره پرسنلی الزامیه (وقتی پرسنل حساب کاربری نداره)" })
  employeeNumber?: string;

  @IsString()
  @MinLength(1, { message: "نام و نام‌خانوادگی الزامیه" })
  fullName!: string;

  // وقتی پر باشه یعنی این پرسنل از قبل در سامانه حساب کاربری داره — فقط به اون کاربر وصل
  // می‌شیم و اطلاعات فردی رو خودش بعداً از پروفایل تکمیل می‌کنه (نگاه کنید به UpdateMyEmployeeDto)
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل نامعتبره" })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: string;

  @IsOptional()
  @IsIn(MILITARY_SERVICE_STATUSES)
  militaryServiceStatus?: string;

  @IsOptional()
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  positionTitle?: string;

  @IsOptional()
  @IsUUID()
  directManagerId?: string;

  @ValidateIf((o) => !o.userId)
  @IsUUID()
  ourEntityId?: string;

  @ValidateIf((o) => !o.userId)
  @IsDateString({}, { message: "تاریخ استخدام نامعتبره" })
  hireDate?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل نامعتبره" })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: string;

  @IsOptional()
  @IsIn(MILITARY_SERVICE_STATUSES)
  militaryServiceStatus?: string;

  @IsOptional()
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  positionTitle?: string;

  @IsOptional()
  @IsUUID()
  directManagerId?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: string;
}

export class ListEmployeesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  status?: string;
}

export class SimilarEmployeesQueryDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

/** تخصیص شماره پرسنلی — لحظه‌ای که یک «کاربر سامانه» رسماً «کارمند شرکت» محسوب می‌شه */
export class AssignEmployeeNumberDto {
  @IsString()
  @MinLength(1, { message: "شماره پرسنلی الزامیه" })
  employeeNumber!: string;

  // اگه در لحظه ثبت اولیه تعیین نشده باشن، الزامی می‌شن (سرویس این رو چک می‌کنه)
  @IsOptional()
  @IsUUID()
  ourEntityId?: string;

  @IsOptional()
  @IsDateString({}, { message: "تاریخ استخدام نامعتبره" })
  hireDate?: string;
}

/** خودسرویس — فقط فیلدهای فردی که در فرم «پرسنل جدید» بودن، به‌جز فیلدهای مدیریتی (بخش/سمت/
 * سرپرست/شرکت گروه/تاریخ استخدام/وضعیت/شماره پرسنلی) که در اختیار منابع انسانی می‌مونن */
export class UpdateMyEmployeeDto {
  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل نامعتبره" })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: string;

  @IsOptional()
  @IsIn(MILITARY_SERVICE_STATUSES)
  militaryServiceStatus?: string;

  @IsOptional()
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;
}
