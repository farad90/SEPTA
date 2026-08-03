import { Type } from "class-transformer";
import { IsBooleanString, IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class OrdersPnlQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @IsOptional()
  @IsUUID()
  salesExpertId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export const PAYMENT_REPORT_TYPES = ["all", "receivable", "payable"] as const;

export class PaymentsQueryDto {
  @IsOptional()
  @IsIn(PAYMENT_REPORT_TYPES)
  type?: (typeof PAYMENT_REPORT_TYPES)[number];

  @IsOptional()
  @IsIn(["all", "unpaid", "paid", "in_progress", "completed"])
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsBooleanString()
  overdueOnly?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class ConversionQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  salesExpertId?: string;

  @IsOptional()
  @IsUUID()
  buyerId?: string;
}
