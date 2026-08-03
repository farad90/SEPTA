import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class UpdateDeliveryDto {
  @IsOptional()
  @IsDateString()
  actualDeliveryDate?: string;

  @IsOptional()
  @IsIn(["in_person", "carrier"])
  deliveryMethod?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  deliveryReceiptFileUrl?: string;

  @IsOptional()
  @IsDateString()
  customerAcceptanceDate?: string;

  @IsOptional()
  @IsIn(["pending", "accepted", "rejected_needs_action"])
  customerAcceptanceStatus?: string;
}

export class UpsertInvoiceDto {
  @IsString()
  @MinLength(1, { message: "شماره فاکتور الزامیه" })
  invoiceNumber!: string;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  paymentDeadline?: string;
}

export class SaveInvoiceItemDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  sourceCustomerPaymentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountCurrency?: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  exchangeRateDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchangeRateValue?: number;
}

/**
 * فیلدهای Wire مطابق FlexPaymentPatch فرانت (برای استفادهٔ مجدد از FlexPaymentList) —
 * چون ستون‌های invoice_collections نام یکسانی با آن ندارن، در سرویس map می‌شن:
 * paymentDescription→follow_up_notes، amount→total_amount،
 * actualPaymentDate→actual_receipt_date، status→settlement_status
 */
export class SaveCollectionDto {
  @IsOptional()
  @IsString()
  paymentDescription?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  actualPaymentDate?: string;

  @IsOptional()
  @IsString()
  paymentDocumentFileUrl?: string;

  @IsOptional()
  @IsIn(["cash", "cheque", "wire_transfer"])
  paymentMethod?: string;

  @IsOptional()
  @IsIn(["settled", "overdue", "pending"])
  status?: string;
}
