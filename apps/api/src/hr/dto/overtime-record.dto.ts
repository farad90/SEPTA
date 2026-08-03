import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateOvertimeRecordDto {
  @IsDateString()
  workDate!: string;

  @IsNumber()
  @Min(0.5)
  @Max(24)
  hours!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  calculatedAmount?: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}
