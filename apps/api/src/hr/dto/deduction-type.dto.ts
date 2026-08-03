import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateDeductionTypeDto {
  @IsString()
  @MinLength(1, { message: "نام نوع کسر الزامیه" })
  deductionName!: string;

  @IsOptional()
  @IsBoolean()
  isRecurringDefault?: boolean;
}

export class UpdateDeductionTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  deductionName?: string;

  @IsOptional()
  @IsBoolean()
  isRecurringDefault?: boolean;
}
