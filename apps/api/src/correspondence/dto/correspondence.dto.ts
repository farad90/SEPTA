import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";

export const LETTER_TYPES = ["incoming", "outgoing", "internal"] as const;
export const LETTER_PRIORITIES = ["normal", "urgent", "very_urgent"] as const;
export const LETTER_STATUSES = ["draft", "registered", "sent", "archived"] as const;
export const WORKFLOW_ACTIONS = ["scanned", "responded", "approved", "sent", "archived"] as const;
export const DOCUMENT_CATEGORIES = [
  "contract",
  "invoice",
  "shipping_doc",
  "customs_doc",
  "technical_file",
  "other",
] as const;

export class LetterPartyDto {
  @IsOptional()
  @IsUUID()
  ourEntityId?: string;

  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;
}

export class CreateLetterDto {
  @IsIn(LETTER_TYPES)
  type!: (typeof LETTER_TYPES)[number];

  @IsDateString()
  letterDate!: string;

  @IsString()
  @MinLength(1, { message: "موضوع نامه الزامیه" })
  subject!: string;

  // اختیاری در سطح DTO — الزام واقعی بسته به `type` در سرویس چک می‌شه (نامه داخلی اصلاً از این فیلدها استفاده نمی‌کنه)
  @IsOptional()
  @ValidateNested()
  @Type(() => LetterPartyDto)
  sender?: LetterPartyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LetterPartyDto)
  receiver?: LetterPartyDto;

  @IsUUID(undefined, { message: "شرکت شماره‌گذاری‌کننده الزامیه" })
  issuingEntityId!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsIn(LETTER_PRIORITIES)
  priority?: (typeof LETTER_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  relatedInquiryId?: string;

  @IsOptional()
  @IsUUID()
  relatedShipmentId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // فاز ۲۴ — فیلدهای وابسته به جهت نامه
  @IsOptional()
  @IsString()
  senderReferenceNumber?: string;

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  signerUserIds?: string[];

  @IsOptional()
  @IsUUID()
  internalFromDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  internalToDepartmentId?: string;
}

export class UpdateLetterDto {
  @IsOptional()
  @IsDateString()
  letterDate?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LetterPartyDto)
  sender?: LetterPartyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LetterPartyDto)
  receiver?: LetterPartyDto;

  @IsOptional()
  @IsUUID()
  issuingEntityId?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsIn(LETTER_PRIORITIES)
  priority?: (typeof LETTER_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  relatedInquiryId?: string;

  @IsOptional()
  @IsUUID()
  relatedShipmentId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReferLetterDto {
  @IsUUID(undefined, { message: "کارشناس مقصد ارجاع الزامیه" })
  referredToUserId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class WorkflowActionDto {
  @IsIn(WORKFLOW_ACTIONS)
  action!: (typeof WORKFLOW_ACTIONS)[number];

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddDocumentDto {
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: (typeof DOCUMENT_CATEGORIES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: (typeof DOCUMENT_CATEGORIES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ListLettersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(LETTER_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(LETTER_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  department?: string;
}
