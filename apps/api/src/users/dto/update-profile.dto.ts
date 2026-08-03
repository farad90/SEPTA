import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsDateString, Matches, Min } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  fullNameEn?: string;

  // شماره داخلی — ستون phone از قبل در جدول users بود ولی هیچ DTO ای ازش استفاده نمی‌کرد
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Matches(/^09\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  mobile?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل نامعتبره" })
  email?: string;

  @IsOptional()
  @IsDateString({}, { message: "تاریخ تولد نامعتبره" })
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  birthCertificateNo?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string | null;
}

export const IDENTITY_DOCUMENT_TYPES = ["national_id_card", "birth_certificate_page"] as const;

export class UpsertIdentityDocumentDto {
  @IsIn(IDENTITY_DOCUMENT_TYPES, { message: "نوع مدرک نامعتبره" })
  documentType!: (typeof IDENTITY_DOCUMENT_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @IsString()
  fileUrl!: string;
}
