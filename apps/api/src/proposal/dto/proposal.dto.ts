import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { DELIVERY_TERMS } from "../../selection/dto/selection.dto";

// فاز ۵۶ — واحد نمایشی زمان تحویل که کارشناس هنگام تایپ در DeliveryTimeInput انتخاب کرده
export const DELIVERY_DAYS_UNITS = ["day", "week"] as const;

// فاز ۵۲ — الهام از نمونه «Sales Order Confirmation» یک شرکت دیگه؛ کلیدهای ثابت چک‌لیست
// مدارک ارسالی همراه محموله (نه یک لیست باز — طبق درخواست صریح کاربر: چک‌لیست، نه متن آزاد)
export const PROPOSAL_DOCUMENT_CHECKLIST_KEYS = [
  "invoice_copy",
  "packing_list",
  "manufacturer_test_certificate",
  "certificate_of_origin",
  "other_on_request",
] as const;

export class FinancialProposalItemDto {
  @IsUUID()
  inquiryItemId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  markupPercent?: number;

  /** اصلاح دستی قیمت فروش نهایی این نسخه — خالی باشه از فی مؤثر × (۱+markup) محاسبه می‌شه */
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalSalePrice?: number;
}

export class SaveFinancialProposalDto {
  @IsOptional()
  @IsUUID()
  ourEntityId?: string;

  @IsIn(DELIVERY_TERMS, { message: "ترم تحویل نامعتبره" })
  chosenDeliveryTerm!: (typeof DELIVERY_TERMS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "زمان تحویل الزامیه" })
  deliveryDays!: number;

  @IsOptional()
  @IsIn(DELIVERY_DAYS_UNITS, { message: "واحد زمان تحویل نامعتبره" })
  deliveryDaysUnit?: (typeof DELIVERY_DAYS_UNITS)[number];

  /** محل تحویل طبق Incoterm — مثلاً "CPT Tehran" */
  @IsOptional()
  @IsString()
  incotermLocation?: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsString()
  currencyCode!: string;

  /** فاز ۵۷ — اگه currencyCode با ارز فعلی این نسخه (هنوز ارسال‌نشده) فرق کنه، الزامیه */
  @IsOptional()
  @IsNumber()
  @Min(0.000001, { message: "نرخ تبدیل باید مثبت باشه" })
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  proposalValidityDate?: string;

  @IsOptional()
  @IsString()
  negotiationNote?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  partialShipmentAllowed?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(PROPOSAL_DOCUMENT_CHECKLIST_KEYS, { each: true, message: "کلید چک‌لیست مدارک نامعتبره" })
  documentsChecklist?: string[];

  @IsOptional()
  @IsString()
  serviceTest?: string;

  @IsOptional()
  @IsString()
  serviceFieldService?: string;

  @IsOptional()
  @IsString()
  serviceDesign?: string;

  @IsOptional()
  @IsString()
  warrantyTerms?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinancialProposalItemDto)
  items!: FinancialProposalItemDto[];
}

export class TechnicalProposalItemDto {
  @IsUUID()
  inquiryItemId!: string;

  @IsOptional()
  @IsString()
  technicalSpecs?: string;

  @IsOptional()
  @IsString()
  complianceNote?: string;
}

export class SaveTechnicalProposalDto {
  @IsOptional()
  @IsUUID()
  ourEntityId?: string;

  /** فاز ۵۴ — پیشنهاد فنی ترم تحویل مستقل خودش رو داره (نه لزوماً همون ترم پیشنهاد مالی) */
  @IsIn(DELIVERY_TERMS, { message: "ترم تحویل نامعتبره" })
  chosenDeliveryTerm!: (typeof DELIVERY_TERMS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "زمان تحویل الزامیه" })
  deliveryTimeEstimateDays!: number;

  @IsOptional()
  @IsIn(DELIVERY_DAYS_UNITS, { message: "واحد زمان تحویل نامعتبره" })
  deliveryDaysUnit?: (typeof DELIVERY_DAYS_UNITS)[number];

  @IsOptional()
  @IsString()
  negotiationNote?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicalProposalItemDto)
  items!: TechnicalProposalItemDto[];
}

export class SetProposalFileDto {
  @IsString()
  fileUrl!: string;
}

export class ReviseFinancialDto {
  /** اگه ست بشه و با ارز نسخه فعلی فرق کنه، exchangeRate الزامی می‌شه */
  @IsOptional()
  @IsString()
  newCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.000001, { message: "نرخ تبدیل باید مثبت باشه" })
  exchangeRate?: number;
}
