import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateBenefitTypeDto {
  @IsString()
  @MinLength(1, { message: "نام نوع مزایا الزامیه" })
  benefitName!: string;

  @IsOptional()
  @IsBoolean()
  isRecurringDefault?: boolean;
}

export class UpdateBenefitTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  benefitName?: string;

  @IsOptional()
  @IsBoolean()
  isRecurringDefault?: boolean;
}
