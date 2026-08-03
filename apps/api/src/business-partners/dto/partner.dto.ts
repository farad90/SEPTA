import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

export const PARTNER_TYPES = [
  "customer",
  "supplier",
  "both",
  "freight_forwarder",
  "organization",
  "bank",
  "service_company",
] as const;

export class CreatePartnerDto {
  @IsIn(PARTNER_TYPES, { message: "نوع شرکت نامعتبره" })
  partnerType!: (typeof PARTNER_TYPES)[number];

  @IsString()
  @MinLength(2, { message: "نام شرکت الزامیه" })
  companyName!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  companyNameEn?: string;

  @IsOptional()
  @IsString()
  addressEn?: string;

  /** اگه خالی بمونه، خودکار از حروف اول companyNameEn ساخته می‌شه */
  @IsOptional()
  @IsString()
  shortCodeEn?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** چند شماره تلفن — phone تکی برای سازگاری اولین عضو این آرایه می‌شه */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phones?: string[];

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsDateString()
  registrationDate?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isForeign?: boolean;
}

export class UpdatePartnerDto extends CreatePartnerDto {
  @IsOptional()
  @IsIn(PARTNER_TYPES)
  declare partnerType: (typeof PARTNER_TYPES)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  declare companyName: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

export class ListPartnersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...PARTNER_TYPES, "all"])
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class SimilarPartnersQueryDto {
  @IsString()
  @MinLength(2, { message: "حداقل ۲ کاراکتر برای بررسی شباهت لازمه" })
  name!: string;
}
