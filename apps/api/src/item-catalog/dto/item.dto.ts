import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class CreateItemDto {
  /** کد کالا — خالی باشه سیستمی تولید می‌شه (ITM-NNNNNN)؛ دستی هم مجازه (یکتا) */
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "کد کالا حداقل ۲ کاراکتر" })
  itemCode?: string;

  /** پارت نامبر — مهم‌ترین مشخصه هر کالا */
  @IsString()
  @MinLength(1, { message: "پارت نامبر الزامیه" })
  partNumber!: string;

  @IsString()
  @MinLength(2, { message: "شرح کالا الزامیه" })
  itemDescription!: string;

  @IsOptional()
  @IsString()
  builder?: string;

  @IsOptional()
  @IsString()
  defaultMeasurementUnit?: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  partNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  itemDescription?: string;

  @IsOptional()
  @IsString()
  builder?: string;

  @IsOptional()
  @IsString()
  defaultMeasurementUnit?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

export class ListItemsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  /** فیلتر برند — چندتایی با کاما: builders=SKF,NTN */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.split(",").filter(Boolean) : value,
  )
  builders?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class SimilarItemsQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateUnitDto {
  @IsString()
  @MinLength(1, { message: "نام واحد الزامیه" })
  unitName!: string;
}

export class AddCatalogDocumentDto {
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
