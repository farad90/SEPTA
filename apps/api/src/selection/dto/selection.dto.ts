import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export const DELIVERY_TERMS = ["EXW", "CPT", "DDP", "CIF", "FOB"] as const;

export class ItemSelectionDto {
  @IsUUID()
  inquiryItemId!: string;

  /** null = برداشتن انتخاب */
  @IsOptional()
  @IsUUID()
  selectedOfferItemId?: string | null;

  @IsOptional()
  @IsString()
  selectionNotes?: string;

  /** فقط با selection.set_markup اعمال می‌شه */
  @IsOptional()
  @IsNumber()
  @Min(0)
  markupPercent?: number;

  /** اصلاح دستی قیمت فروش نهایی — خالی باشه سرور محاسبه می‌کنه */
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalSalePrice?: number;
}

export class OfferDistributeDto {
  @IsUUID()
  offerId!: string;

  @IsBoolean()
  distributeVat!: boolean;

  @IsBoolean()
  distributeOtherCosts!: boolean;
}

/** فاز ۵۷ — نرخ تبدیل دستی یک ارز آفر تأمین‌کننده به ارز مبنای انتخاب‌شده برای این پرونده */
export class SelectionExchangeRateDto {
  @IsString()
  @MinLength(3)
  fromCurrencyCode!: string;

  @IsNumber()
  @Min(0.000001, { message: "نرخ تبدیل باید مثبت باشه" })
  rate!: number;
}

export class SaveSelectionDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSelectionDto)
  items?: ItemSelectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferDistributeDto)
  offers?: OfferDistributeDto[];

  /** فاز ۵۷ — ارز مبنای مرحله انتخاب نهایی؛ null یعنی غیرفعال کردن (بازگشت به رفتار قبلی) */
  @IsOptional()
  @IsString()
  selectionBaseCurrencyCode?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionExchangeRateDto)
  exchangeRates?: SelectionExchangeRateDto[];
}

export class DeliveryOptionDto {
  @IsIn(DELIVERY_TERMS, { message: "ترم تحویل نامعتبره" })
  deliveryTerm!: (typeof DELIVERY_TERMS)[number];

  @IsNumber()
  @Min(0)
  extraCost!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "زمان تحویل الزامیه" })
  deliveryDays!: number;
}

export class SaveDeliveryOptionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => DeliveryOptionDto)
  options!: DeliveryOptionDto[];
}

export class LockSelectionDto {
  @IsOptional()
  @IsString()
  managerNoteToSales?: string;
}

// ============================================================
// فاز ۶۰ (اصلاح) — قیمت‌گذاری بازرگانی به تفکیک ترم تحویل، در همین مرحله («انتخاب نهایی و
// قیمت‌گذاری») نه در تب «پیشنهاد به مشتری» — طبق بازخورد صریح کاربر
// ============================================================

export class SavePricingCostDto {
  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currencyCode!: string;

  @IsOptional()
  @IsBoolean()
  includeInMarginBase?: boolean;

  /** خالی = روی همه گزینه‌های ترم تحویل این پرونده اعمال می‌شه؛ پرشده = فقط همون ترم */
  @IsOptional()
  @IsIn(DELIVERY_TERMS, { message: "ترم تحویل نامعتبره" })
  deliveryTerm?: (typeof DELIVERY_TERMS)[number];
}

export class AddPricingOptionDto {
  @IsIn(DELIVERY_TERMS, { message: "ترم تحویل نامعتبره" })
  deliveryTerm!: (typeof DELIVERY_TERMS)[number];

  @IsOptional()
  @IsString()
  incotermLocation?: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "زمان تحویل الزامیه" })
  deliveryDays!: number;

  @IsOptional()
  @IsIn(["day", "week"], { message: "واحد زمان تحویل نامعتبره" })
  deliveryDaysUnit?: "day" | "week";

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsString()
  currencyCode!: string;

  /** اگه ارز این گزینه با ارز مبنای انتخاب نهایی فرق کنه، الزامیه */
  @IsOptional()
  @IsNumber()
  @Min(0.000001, { message: "نرخ تبدیل باید مثبت باشه" })
  exchangeRate?: number;

  @IsOptional()
  @IsNumber()
  defaultMarkupPercent?: number;
}

export class PricingItemOverrideDto {
  @IsUUID()
  inquiryItemId!: string;

  @IsNumber()
  @Min(-100, { message: "درصد مارک‌آپ نمی‌تواند کمتر از ۱۰۰-‎ باشد" })
  markupPercent!: number;
}

export class SavePricingOptionMarkupDto {
  /** «اعمال مارک‌آپ به همه» — روی هر قلمی که در items override نشده اعمال می‌شه */
  @IsOptional()
  @IsNumber()
  @Min(-100, { message: "درصد مارک‌آپ نمی‌تواند کمتر از ۱۰۰-‎ باشد" })
  defaultMarkupPercent?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingItemOverrideDto)
  items?: PricingItemOverrideDto[];
}
