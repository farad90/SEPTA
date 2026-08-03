import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
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

export const INQUIRY_STATUSES = [
  "in_progress",
  "won",
  "lost",
  "partially_won",
  "cancelled",
  "suspended",
  "declined",
] as const;

export const INQUIRY_CHANNELS = ["email", "phone", "in_person", "tender_system"] as const;

export class CreateInquiryItemDto {
  @IsString()
  @MinLength(1, { message: "کد کالا الزامیه" })
  itemCode!: string;

  @IsString()
  @MinLength(1, { message: "شرح کالا الزامیه" })
  description!: string;

  @IsNumber()
  @IsPositive({ message: "مقدار باید بزرگ‌تر از صفر باشه" })
  quantity!: number;

  @IsString()
  @MinLength(1, { message: "واحد اندازه‌گیری الزامیه" })
  measurementUnit!: string;

  @IsOptional()
  @IsString()
  equivalentType?: string;

  @IsOptional()
  @IsString()
  drawingTypeRow?: string;

  @IsOptional()
  @IsString()
  partNumber?: string;

  @IsOptional()
  @IsString()
  drawingNumber?: string;

  @IsOptional()
  @IsString()
  builder?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;
}

export class CreateInquiryDto {
  @IsOptional()
  @IsString()
  inquiryNumber?: string;

  @IsUUID(undefined, { message: "شرکت مشتری الزامیه" })
  buyerId!: string;

  @IsOptional()
  @IsUUID()
  buyerContactId?: string;

  @IsString()
  @MinLength(2, { message: "موضوع استعلام الزامیه" })
  subject!: string;

  @IsDateString({}, { message: "مهلت ارائه پیشنهاد نامعتبره" })
  offerEndDate!: string;

  @IsOptional()
  @IsDateString()
  extendedOfferEndDate?: string;

  @IsOptional()
  @IsBoolean()
  isEquivalentAccepted?: boolean;

  @IsOptional()
  @IsString()
  settlementTerms?: string;

  @IsOptional()
  @IsBoolean()
  advancePaymentAvailable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  /** پیش‌فرض: کاربر جاری — مدیر می‌تونه به کارشناس دیگه واگذار کنه */
  @IsOptional()
  @IsUUID()
  salesExpertId?: string;

  @IsDateString({}, { message: "تاریخ شروع استعلام نامعتبره" })
  inquiryStartDate!: string;

  @IsOptional()
  @IsIn(INQUIRY_CHANNELS)
  channel?: (typeof INQUIRY_CHANNELS)[number];

  @IsOptional()
  @IsIn(["normal", "urgent"])
  urgency?: "normal" | "urgent";

  @IsArray()
  @ArrayMinSize(1, { message: "حداقل یک قلم کالا لازمه" })
  @ValidateNested({ each: true })
  @Type(() => CreateInquiryItemDto)
  items!: CreateInquiryItemDto[];
}

export class UpdateInquiryDto {
  @IsOptional()
  @IsString()
  inquiryNumber?: string;

  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @IsOptional()
  @IsUUID()
  buyerContactId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  subject?: string;

  @IsOptional()
  @IsDateString()
  offerEndDate?: string;

  // string | null | undefined: undefined = دست‌نخورده بمونه، null = صراحتاً پاک بشه
  @IsOptional()
  @IsDateString()
  extendedOfferEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isEquivalentAccepted?: boolean;

  @IsOptional()
  @IsString()
  settlementTerms?: string;

  @IsOptional()
  @IsBoolean()
  advancePaymentAvailable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  inquiryStartDate?: string;

  @IsOptional()
  @IsIn(INQUIRY_CHANNELS)
  channel?: (typeof INQUIRY_CHANNELS)[number];

  @IsOptional()
  @IsIn(["normal", "urgent"])
  urgency?: "normal" | "urgent";

  @IsOptional()
  @IsIn(INQUIRY_STATUSES)
  status?: (typeof INQUIRY_STATUSES)[number];
}

export class UpdateInquiryItemDto extends CreateInquiryItemDto {
  @IsOptional()
  declare itemCode: string;

  @IsOptional()
  declare description: string;

  @IsOptional()
  declare quantity: number;

  @IsOptional()
  declare measurementUnit: string;
}

export class AssignInquiryDto {
  @IsUUID()
  salesExpertId!: string;
}

export class DeclineInquiryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddItemDocumentDto {
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class AddInquiryDocumentDto {
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class CreateDiscussionMessageDto {
  @IsString()
  @MinLength(1, { message: "متن پیام خالیه" })
  commentText!: string;

  @IsOptional()
  @IsUUID()
  mentionedUserId?: string;

  @IsOptional()
  @IsIn(["general", "technical_question"])
  tag?: "general" | "technical_question";
}

export class ListInquiriesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...INQUIRY_STATUSES, "all"])
  status?: string;

  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @IsOptional()
  @IsUUID()
  salesExpertId?: string;

  @IsOptional()
  @IsIn(["deadline", "createdAt"])
  sortBy?: "deadline" | "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}
