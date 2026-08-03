import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export const SUPPLIER_PAYMENT_STATUSES = ["unpaid", "in_progress", "completed"] as const;

export class SavePoDto {
  @IsOptional()
  @IsString()
  poNumber?: string;

  @IsOptional()
  @IsUUID()
  ourEntityId?: string;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  deliveryDueDate?: string;
}

export class SaveSupplierPaymentDto {
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
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsIn(SUPPLIER_PAYMENT_STATUSES)
  status?: (typeof SUPPLIER_PAYMENT_STATUSES)[number];
}
