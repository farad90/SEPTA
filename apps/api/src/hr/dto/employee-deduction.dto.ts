import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateEmployeeDeductionDto {
  @IsUUID()
  deductionTypeId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  currencyCode!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsUUID()
  relatedLoanId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeDeductionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsUUID()
  relatedLoanId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
