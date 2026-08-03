import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreatePayrollYearDto {
  @IsInt()
  @Min(1000)
  yearNumber!: number;

  @IsIn(["jalali", "gregorian"])
  calendarType!: string;
}

export class CreateRuleVersionDto {
  @IsUUID()
  payrollYearId!: string;

  @IsInt()
  @Min(1)
  versionNumber!: number;

  @IsString()
  @MinLength(1, { message: "عنوان نسخه الزامیه" })
  title!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateRuleVersionStatusDto {
  @IsIn(["draft", "active", "superseded"])
  status!: string;
}

export class UpsertRuleDto {
  @IsString()
  @MinLength(1, { message: "کد قانون الزامیه" })
  code!: string;

  @IsString()
  @MinLength(1, { message: "عنوان الزامیه" })
  title!: string;

  @IsIn(["number", "percent", "boolean"])
  valueType!: string;

  @IsNumber()
  value!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsDateString()
  expireDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class TaxBracketDto {
  @IsInt()
  @Min(1)
  bracketOrder!: number;

  @IsNumber()
  @Min(0)
  fromAmount!: number;

  @IsOptional()
  @IsNumber()
  toAmount?: number | null;

  @IsNumber()
  @Min(0)
  ratePercent!: number;
}

export class ReplaceBracketsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxBracketDto)
  brackets!: TaxBracketDto[];
}

export class UpsertFormulaDto {
  @IsString()
  @MinLength(1, { message: "کد فرمول الزامیه" })
  code!: string;

  @IsString()
  @MinLength(1, { message: "عبارت فرمول الزامیه" })
  expression!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateComponentDto {
  @IsString()
  @MinLength(1, { message: "کد جزء الزامیه" })
  code!: string;

  @IsString()
  @MinLength(1, { message: "عنوان الزامیه" })
  title!: string;

  @IsIn(["earning", "deduction"])
  componentType!: string;

  @IsOptional()
  @IsBoolean()
  isInsurable?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsInt()
  calcOrder?: number;

  @IsOptional()
  @IsUUID()
  formulaId?: string;
}

export class UpdateComponentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsIn(["earning", "deduction"])
  componentType?: string;

  @IsOptional()
  @IsBoolean()
  isInsurable?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsInt()
  calcOrder?: number;

  @IsOptional()
  @IsUUID()
  formulaId?: string | null;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;
}
