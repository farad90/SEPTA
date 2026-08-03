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
