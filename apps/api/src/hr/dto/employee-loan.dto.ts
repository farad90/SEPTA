import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateEmployeeLoanDto {
  @IsNumber()
  @Min(1)
  loanAmount!: number;

  @IsString()
  @MinLength(3)
  currencyCode!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  installmentCount!: number;

  @IsDateString()
  startDeductionDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
