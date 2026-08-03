import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1, { message: "نام نوع مرخصی الزامیه" })
  typeName!: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualEntitlementDays?: number;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  typeName?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualEntitlementDays?: number;
}
