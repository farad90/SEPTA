import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

// فاز ۲۷ — فیلدهای *FileUrl تک‌فایله از DTO ها حذف شدن (Deprecated)؛
// فایل‌ها از این به بعد از مسیر اسناد چندفایلی (AddShipmentDocumentDto) ثبت می‌شن

export class UpdateShipmentDto {
  @IsOptional()
  @IsString()
  billOfLadingNumber?: string;

  @IsOptional()
  @IsDateString()
  loadingDate?: string;

  @IsOptional()
  @IsDateString()
  eta?: string;

  @IsOptional()
  @IsString()
  exportDeclarationNumber?: string;

  @IsOptional()
  @IsString()
  customsDeclarationNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  customsDutiesAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  clearanceFeesAmount?: number;

  @IsOptional()
  @IsString()
  clearanceAgentName?: string;
}

export class UpdateExportDocumentsDto {
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  packingListNumber?: string;
}

export class UpdateImportDocumentsDto {
  @IsOptional()
  @IsString()
  tradeSystemRegistrationNumber?: string;

  @IsOptional()
  @IsDateString()
  tradeSystemRegistrationDate?: string;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @IsOptional()
  @IsString()
  insuranceCompany?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceAmount?: number;

  @IsOptional()
  @IsDateString()
  insuranceIssueDate?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiryDate?: string;

  @IsOptional()
  @IsString()
  importInvoiceNumber?: string;

  @IsOptional()
  @IsString()
  importPackingListNumber?: string;

  @IsOptional()
  @IsString()
  warehouseSlipNumber?: string;

  @IsOptional()
  @IsString()
  freightInvoiceRialNumber?: string;

  @IsOptional()
  @IsString()
  freightInvoiceForexNumber?: string;
}

/** ۱۷ جایگاه سند محموله — هرکدوم به مرحلهٔ خودش نگاشت می‌شه (نگاشت در سرویس) */
export const SHIPMENT_DOC_KEYS = [
  "export_invoice",
  "export_packing_list",
  "non_dual_use",
  "power_of_attorney",
  "export_declaration",
  "import_invoice",
  "import_packing_list",
  "bill_of_lading",
  "warehouse_slip",
  "clearance_permit",
  "freight_invoice_rial",
  "freight_invoice_forex",
  "inspection_certificate",
  "certificate_of_origin",
  "customs_declaration",
  "weighbridge_slip",
  "customs_exit_waybill",
] as const;

export type ShipmentDocKey = (typeof SHIPMENT_DOC_KEYS)[number];

export class AddShipmentDocumentDto {
  @IsIn(SHIPMENT_DOC_KEYS as unknown as string[])
  docKey!: ShipmentDocKey;

  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class CreateEditRequestDto {
  @IsString()
  @MinLength(1)
  stage!: string;

  @IsString()
  @MinLength(3, { message: "دلیل درخواست الزامیه" })
  reason!: string;
}
