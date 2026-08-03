import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateOurEntityDto {
  @IsString()
  @MinLength(1, { message: "نام شرکت الزامیه" })
  entityName!: string;

  @IsString()
  @MinLength(1, { message: "کد اختصاری الزامیه" })
  shortCode!: string;

  @IsIn(["jalali", "gregorian"])
  calendarType!: string;

  @IsString()
  @MinLength(1, { message: "کشور الزامیه" })
  country!: string;

  @IsOptional()
  @IsString()
  entityNameEn?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  addressEn?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}

export class UpdateOurEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  entityName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  shortCode?: string;

  @IsOptional()
  @IsIn(["jalali", "gregorian"])
  calendarType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  country?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @IsOptional()
  @IsString()
  entityNameEn?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  addressEn?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}
