import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateEmployeeBenefitDto {
  @IsUUID()
  benefitTypeId!: string;

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
  @IsString()
  notes?: string;
}

export class UpdateEmployeeBenefitDto {
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
  @IsString()
  notes?: string;
}
