import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateMissionRequestDto {
  @IsString()
  @MinLength(1, { message: "مقصد الزامیه" })
  destination!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  transportationMethod?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}
