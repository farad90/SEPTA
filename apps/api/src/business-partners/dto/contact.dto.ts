import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export const CONTACT_TYPES = ["technical", "financial", "commercial", "purchasing", "other"] as const;
export const CONTACT_LEVELS = ["expert", "manager", "ceo"] as const;

export class CreateContactDto {
  @IsString()
  @MinLength(2, { message: "نام رابط الزامیه" })
  contactName!: string;

  @IsOptional()
  @IsString()
  contactNameEn?: string;

  @IsOptional()
  @IsIn(CONTACT_TYPES, { message: "نوع رابط نامعتبره" })
  contactType?: (typeof CONTACT_TYPES)[number];

  @IsOptional()
  @IsIn(CONTACT_LEVELS, { message: "سطح سازمانی نامعتبره" })
  level?: (typeof CONTACT_LEVELS)[number];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email?: string;

  @IsOptional()
  @IsString()
  department?: string;

  /** شماره داخلی */
  @IsOptional()
  @IsString()
  extension?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContactDto extends CreateContactDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  declare contactName: string;
}
