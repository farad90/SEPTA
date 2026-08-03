import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export const PRODUCTION_STATUSES = ["in_production", "ready_to_ship", "in_transit"] as const;

export class UpdateProductionTrackingDto {
  @IsOptional()
  @IsIn(PRODUCTION_STATUSES)
  status?: (typeof PRODUCTION_STATUSES)[number];

  @IsOptional()
  @IsString()
  estimatedReadyDate?: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  pickupPhone?: string;

  @IsOptional()
  @IsString()
  pickupContactName?: string;

  @IsOptional()
  @IsString()
  pickupContactEmail?: string;

  @IsOptional()
  @IsString()
  pickupContactPhone?: string;
}

export class AddProductionLogDto {
  @IsOptional()
  @IsString()
  logDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}

export class SavePackageDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsString()
  pickupLocation?: string;

  @IsOptional()
  @IsIn(["defining", "ready_to_ship"])
  status?: "defining" | "ready_to_ship";
}

export class WarehouseReceiptItemInputDto {
  @IsUUID()
  inquiryItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQuantity!: number;
}

export class SaveWarehouseReceiptItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WarehouseReceiptItemInputDto)
  items!: WarehouseReceiptItemInputDto[];
}

export class AddWarehouseReceiptPhotoDto {
  @IsString()
  @MinLength(1)
  photoUrl!: string;
}
