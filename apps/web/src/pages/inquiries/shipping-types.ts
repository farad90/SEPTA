export const PRODUCTION_STATUSES = ["in_production", "ready_to_ship", "in_transit"] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const PRODUCTION_STATUS_META: Record<ProductionStatus, { label: string; className: string }> = {
  in_production: { label: "در حال تولید", className: "bg-warningSoft text-warning" },
  ready_to_ship: { label: "آماده حمل", className: "bg-accentSoft text-accent" },
  in_transit: { label: "در حال حمل", className: "bg-successSoft text-success" },
};

export interface ProductionLog {
  id: string;
  logDate: string;
  note: string | null;
  documentUrl: string | null;
}

export interface PackageRow {
  id: string;
  packageNumber: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number;
  pickupLocation: string;
  status: "defining" | "ready_to_ship";
}

export interface ProductionEntry {
  poId: string;
  poNumber: string;
  supplierName: string;
  status: ProductionStatus;
  estimatedReadyDate: string | null;
  pickupAddress: string | null;
  pickupPhone: string | null;
  pickupContactName: string | null;
  pickupContactEmail: string | null;
  pickupContactPhone: string | null;
  logs: ProductionLog[];
  packages: PackageRow[];
}

export interface ShipmentStatusRow {
  poId: string;
  poNumber: string;
  supplierName: string;
  shipmentNumber: string | null;
  stage: string | null;
}

export const SHIPMENT_STAGE_META: Record<string, { label: string; className: string }> = {
  consolidating: { label: "در حال تجمیع", className: "bg-warningSoft text-warning" },
  in_transit: { label: "در حال حمل", className: "bg-accentSoft text-accent" },
  export_declared: { label: "در حال ترخیص", className: "bg-warningSoft text-warning" },
  iran_docs_sent: { label: "در حال ترخیص", className: "bg-warningSoft text-warning" },
  customs_declared: { label: "در حال ترخیص", className: "bg-warningSoft text-warning" },
  cleared: { label: "ترخیص شده — آماده تحویل به مشتری", className: "bg-successSoft text-success" },
};

export interface WarehouseReceiptPhoto {
  id: string;
  photoUrl: string;
}

export interface WarehouseReceiptItemRow {
  inquiryItemId: string;
  itemCode: string;
  description: string;
  orderedQuantity: number;
  measurementUnit: string;
  receivedQuantity: number | null;
  photos: WarehouseReceiptPhoto[];
  receiptItemId: string | null;
}

export interface WarehouseReceipt {
  shipmentNumber: string;
  items: WarehouseReceiptItemRow[];
}
