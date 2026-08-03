import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export const GUARANTEE_TYPES = ["advance_payment", "performance"] as const;
export const GUARANTEE_STATUSES = ["active", "released", "called"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;

export class SaveOrderDto {
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsString()
  contractDate?: string;

  @IsOptional()
  @IsString()
  deliveryDueDate?: string;

  @IsOptional()
  @IsString()
  contractFileUrl?: string;
}

export class SaveCustomerPaymentDto {
  @IsOptional()
  @IsString()
  paymentDescription?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  actualPaymentDate?: string;

  @IsOptional()
  @IsString()
  paymentDocumentFileUrl?: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];
}

export class SaveGuaranteeDto {
  @IsOptional()
  @IsIn(GUARANTEE_TYPES)
  guaranteeType?: (typeof GUARANTEE_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  issuingBank?: string;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsIn(GUARANTEE_STATUSES)
  status?: (typeof GUARANTEE_STATUSES)[number];
}
