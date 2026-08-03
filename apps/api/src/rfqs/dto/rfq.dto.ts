import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateRfqDto {
  @IsUUID(undefined, { message: "تأمین‌کننده الزامیه" })
  supplierId!: string;

  @IsUUID(undefined, { message: "شرکت گروه (طرف ارسال‌کننده) الزامیه" })
  ourEntityId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: "حداقل یک قلم برای RFQ لازمه" })
  @IsUUID(undefined, { each: true })
  inquiryItemIds!: string[];

  @IsEmail({}, { message: "ایمیل گیرنده معتبر نیست" })
  recipientEmail!: string;

  @IsOptional()
  @IsString()
  emailSubject?: string;

  /** پیش‌فرض: امروز + RFQ_RESPONSE_DUE_DAYS */
  @IsOptional()
  @IsDateString()
  responseDueDate?: string;
}

export class TechnicalQuestionDto {
  @IsString()
  @MinLength(2, { message: "متن سوال فنی الزامیه" })
  questionText!: string;
}

export class RejectRfqDto {
  @IsString()
  @MinLength(2, { message: "علت رد توسط تأمین‌کننده الزامیه" })
  reason!: string;
}

export class OfferItemDto {
  @IsUUID()
  inquiryItemId!: string;

  @IsNumber()
  @IsPositive({ message: "قیمت باید بزرگ‌تر از صفر باشه" })
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  deliveryTimeDays?: number;

  @IsOptional()
  @IsString()
  partNumber?: string;

  /** فاز ۵۵ — برند/سازنده‌ی پیشنهادی همین آفر (ممکنه با برند اولیه‌ی استعلام فرق داشته باشه) */
  @IsOptional()
  @IsString()
  builder?: string;

  @IsOptional()
  @IsString()
  countryOfOrigin?: string;

  @IsOptional()
  @IsBoolean()
  isEquivalent?: boolean;

  @IsOptional()
  @IsString()
  technicalSpecs?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsDateString()
  offerValidityDate?: string;

  @IsOptional()
  @IsString()
  datasheetUrl?: string;
}

export class CreateOfferDto {
  @IsOptional()
  @IsString()
  offerNumber?: string;

  @IsOptional()
  @IsDateString()
  offerDate?: string;

  @IsString()
  @MinLength(3)
  currencyCode!: string;

  @IsOptional()
  @IsString()
  offerContactName?: string;

  @IsOptional()
  @IsBoolean()
  vatApplicable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  vatRatePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  otherCosts?: number;

  @IsOptional()
  @IsString()
  generalRemarks?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "حداقل قیمت یک قلم لازمه" })
  @ValidateNested({ each: true })
  @Type(() => OfferItemDto)
  items!: OfferItemDto[];
}

export class UpdateRfqStatusDto {
  @IsIn(["awaiting_response", "no_response"], {
    message: "فقط بازگشت بین «در انتظار پاسخ» و «بدون پاسخ» مجازه",
  })
  status!: "awaiting_response" | "no_response";
}

export class CreateRfqDeleteRequestDto {
  @IsString()
  @MinLength(3, { message: "دلیل درخواست حذف الزامیه" })
  reason!: string;
}

export class AddOfferDocumentDto {
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
