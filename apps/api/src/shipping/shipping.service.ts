import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddProductionLogDto,
  AddWarehouseReceiptPhotoDto,
  SavePackageDto,
  SaveWarehouseReceiptItemsDto,
  UpdateProductionTrackingDto,
} from "./dto/shipping.dto";

/**
 * فاز ۱۰ — پیگیری تولید + بسته‌بندی (تب ۸، بخش اول دامنه ۶). هر PO دقیقاً یک
 * production_tracking داره (seed خودکار در اولین GET). بسته بعد از اعلام
 * «آماده حمل» دیگه قابل ویرایش/حذف نیست.
 * فاز ۱۲ — تکمیل تب ۸: کارت فقط‌خواندنی وضعیت محموله + دریافت کالا در انبار،
 * با تشخیص خودکار تک‌محموله (چون package_items پیاده نشده، نمی‌شه دقیقاً دونست
 * کدوم قلم از کدوم محموله اومده — پرونده‌ای که از چند محموله جدا تشکیل شده باشه
 * پشتیبانی نمی‌شه، طبق تصمیم صریح فاز ۱۲).
 */
@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------
  // نمای تجمیعی تب ۸ (بخش اول) — یک ردیف به‌ازای هر PO
  // ------------------------------------------------------------

  async getProductionTracking(inquiryId: string) {
    const pos = await this.getInquiryPosOrThrow(inquiryId);
    const result = [];
    for (const po of pos) {
      const tracking = await this.getOrSeedTracking(po.id);
      result.push(await this.formatEntry(po, tracking.id));
    }
    return result;
  }

  // ------------------------------------------------------------
  // وضعیت/pickup
  // ------------------------------------------------------------

  async updateTracking(inquiryId: string, poId: string, dto: UpdateProductionTrackingDto) {
    const po = await this.getPoOrThrow(inquiryId, poId);
    const tracking = await this.getOrSeedTracking(po.id);
    await this.prisma.productionTracking.update({
      where: { id: tracking.id },
      data: {
        status: dto.status,
        estimatedReadyDate: dto.estimatedReadyDate ? new Date(dto.estimatedReadyDate) : undefined,
        pickupAddress: dto.pickupAddress,
        pickupPhone: dto.pickupPhone,
        pickupContactName: dto.pickupContactName,
        pickupContactEmail: dto.pickupContactEmail,
        pickupContactPhone: dto.pickupContactPhone,
        updatedAt: new Date(),
      },
    });
    return this.getProductionTracking(inquiryId);
  }

  async addLog(inquiryId: string, poId: string, dto: AddProductionLogDto) {
    const po = await this.getPoOrThrow(inquiryId, poId);
    const tracking = await this.getOrSeedTracking(po.id);
    await this.prisma.productionTrackingLog.create({
      data: {
        productionTrackingId: tracking.id,
        logDate: dto.logDate ? new Date(dto.logDate) : new Date(),
        note: dto.note,
        documentUrl: dto.documentUrl,
      },
    });
    return this.getProductionTracking(inquiryId);
  }

  // ------------------------------------------------------------
  // بسته‌بندی
  // ------------------------------------------------------------

  /** ردیف خالی هم مجازه — الگوی UI: افزودن ردیف خالی و بعد ویرایش خطی (طبق اصلاح فازهای ۸/۹) */
  async addPackage(inquiryId: string, poId: string) {
    const po = await this.getPoOrThrow(inquiryId, poId);
    const count = await this.prisma.package.count({ where: { poId: po.id } });
    await this.prisma.package.create({
      data: {
        poId: po.id,
        packageNumber: `بسته ${count + 1}`,
        weightKg: 0,
        pickupLocation: "",
        status: "defining",
      },
    });
    return this.getProductionTracking(inquiryId);
  }

  async updatePackage(packageId: string, dto: SavePackageDto) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, status: true, po: { select: { orderId: true, order: { select: { inquiryId: true } } } } },
    });
    if (!pkg) throw new NotFoundException("بسته یافت نشد");

    const wantsReadyTransition = dto.status === "ready_to_ship" && pkg.status === "defining";
    const otherFieldsProvided =
      dto.lengthCm !== undefined ||
      dto.widthCm !== undefined ||
      dto.heightCm !== undefined ||
      dto.weightKg !== undefined ||
      dto.pickupLocation !== undefined;

    if (pkg.status === "ready_to_ship" && (otherFieldsProvided || dto.status)) {
      throw new BadRequestException("این بسته قبلاً «آماده حمل» اعلام شده — دیگه قابل ویرایش نیست");
    }
    if (dto.status && dto.status !== "ready_to_ship") {
      throw new BadRequestException("امکان برگردوندن بسته به حالت «در حال تعریف» وجود نداره");
    }

    await this.prisma.package.update({
      where: { id: packageId },
      data: {
        lengthCm: dto.lengthCm,
        widthCm: dto.widthCm,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        pickupLocation: dto.pickupLocation,
        status: wantsReadyTransition ? "ready_to_ship" : undefined,
      },
    });
    return this.getProductionTracking(pkg.po.order.inquiryId);
  }

  async deletePackage(packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, status: true, po: { select: { order: { select: { inquiryId: true } } } } },
    });
    if (!pkg) throw new NotFoundException("بسته یافت نشد");
    if (pkg.status !== "defining") {
      throw new BadRequestException("بسته «آماده حمل» شده رو نمی‌شه حذف کرد");
    }
    await this.prisma.package.delete({ where: { id: packageId } });
    return this.getProductionTracking(pkg.po.order.inquiryId);
  }

  // ------------------------------------------------------------
  // وضعیت محموله (فقط‌خواندنی) — فاز ۱۲
  // ------------------------------------------------------------

  async getShipmentStatus(inquiryId: string) {
    const pos = await this.getInquiryPosOrThrow(inquiryId);
    const result = [];
    for (const po of pos) {
      const shipmentPackage = await this.prisma.shipmentPackage.findFirst({
        where: { package: { poId: po.id } },
        include: { shipment: { select: { shipmentNumber: true, stage: true } } },
      });
      result.push({
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.companyName,
        shipmentNumber: shipmentPackage?.shipment.shipmentNumber ?? null,
        stage: shipmentPackage?.shipment.stage ?? null,
      });
    }
    return result;
  }

  // ------------------------------------------------------------
  // دریافت کالا در انبار — فاز ۱۲
  // ------------------------------------------------------------

  async getWarehouseReceipt(inquiryId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const shipment = await this.getSingleClearedShipmentOrThrow(orderId);
    const receipt = await this.getOrSeedWarehouseReceipt(shipment.id, shipment.shipmentNumber);

    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { inquiryItem: { select: { id: true, itemCode: true, description: true, measurementUnit: true } } },
      orderBy: { inquiryItem: { rowIndex: "asc" } },
    });

    const receiptItems = await this.prisma.warehouseReceiptItem.findMany({
      where: { warehouseReceiptId: receipt.id },
      include: { photos: { orderBy: { uploadedAt: "asc" } } },
    });
    const receiptItemByInquiryItem = new Map(receiptItems.map((r) => [r.inquiryItemId, r]));

    return {
      shipmentNumber: shipment.shipmentNumber,
      items: orderItems.map((oi) => {
        const r = receiptItemByInquiryItem.get(oi.inquiryItemId);
        return {
          inquiryItemId: oi.inquiryItemId,
          itemCode: oi.inquiryItem.itemCode,
          description: oi.inquiryItem.description,
          orderedQuantity: Number(oi.quantity),
          measurementUnit: oi.inquiryItem.measurementUnit,
          receivedQuantity: r ? Number(r.receivedQuantity) : null,
          photos: r ? r.photos.map((p) => ({ id: p.id, photoUrl: p.photoUrl })) : [],
          receiptItemId: r?.id ?? null,
        };
      }),
    };
  }

  async saveWarehouseReceiptItems(inquiryId: string, dto: SaveWarehouseReceiptItemsDto) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const shipment = await this.getSingleClearedShipmentOrThrow(orderId);
    const receipt = await this.getOrSeedWarehouseReceipt(shipment.id, shipment.shipmentNumber);

    const validItemIds = new Set(
      (await this.prisma.orderItem.findMany({ where: { orderId }, select: { inquiryItemId: true } })).map(
        (oi) => oi.inquiryItemId,
      ),
    );
    for (const item of dto.items) {
      if (!validItemIds.has(item.inquiryItemId)) {
        throw new BadRequestException("این قلم متعلق به این پرونده نیست");
      }
      await this.prisma.warehouseReceiptItem.upsert({
        where: { warehouseReceiptId_inquiryItemId: { warehouseReceiptId: receipt.id, inquiryItemId: item.inquiryItemId } },
        create: { warehouseReceiptId: receipt.id, inquiryItemId: item.inquiryItemId, receivedQuantity: item.receivedQuantity },
        update: { receivedQuantity: item.receivedQuantity },
      });
    }
    return this.getWarehouseReceipt(inquiryId);
  }

  async addWarehouseReceiptPhoto(receiptItemId: string, dto: AddWarehouseReceiptPhotoDto) {
    const receiptItem = await this.prisma.warehouseReceiptItem.findUnique({
      where: { id: receiptItemId },
      select: { id: true, inquiryItem: { select: { inquiryId: true } } },
    });
    if (!receiptItem) {
      throw new NotFoundException("ردیف دریافت انبار یافت نشد");
    }
    await this.prisma.warehouseReceiptPhoto.create({
      data: { warehouseReceiptItemId: receiptItemId, photoUrl: dto.photoUrl },
    });
    return this.getWarehouseReceipt(receiptItem.inquiryItem.inquiryId);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getOrderIdOrThrow(inquiryId: string): Promise<string> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, deletedAt: true },
    });
    if (!inquiry || inquiry.deletedAt) {
      throw new NotFoundException("پرونده استعلام یافت نشد");
    }
    const order = await this.prisma.order.findFirst({ where: { inquiryId }, select: { id: true } });
    if (!order) {
      throw new BadRequestException("ابتدا باید سفارش مشتری (تب ۶) ثبت بشه");
    }
    return order.id;
  }

  private async getInquiryPosOrThrow(inquiryId: string) {
    const orderId = await this.getOrderIdOrThrow(inquiryId);
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { orderId },
      include: { supplier: { select: { companyName: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (pos.length === 0) {
      throw new BadRequestException("ابتدا باید حداقل یک سفارش خرید (PO، تب ۷) صادر بشه");
    }
    return pos;
  }

  /** تشخیص خودکار تک‌محموله برای دریافت انبار — طبق تصمیم فاز ۱۲ */
  private async getSingleClearedShipmentOrThrow(orderId: string) {
    const shipmentPackages = await this.prisma.shipmentPackage.findMany({
      where: { package: { po: { orderId } } },
      include: { shipment: { select: { id: true, shipmentNumber: true, stage: true } } },
    });
    const clearedShipments = new Map(
      shipmentPackages.filter((sp) => sp.shipment.stage === "cleared").map((sp) => [sp.shipment.id, sp.shipment]),
    );
    if (clearedShipments.size === 0) {
      throw new BadRequestException("هنوز هیچ محموله‌ای برای این پرونده ترخیص نشده");
    }
    if (clearedShipments.size > 1) {
      throw new BadRequestException(
        "این پرونده از چند محموله جدا تشکیل شده — این حالت پشتیبانی نمی‌شه",
      );
    }
    return [...clearedShipments.values()][0];
  }

  private async getOrSeedWarehouseReceipt(shipmentId: string, shipmentNumber: string) {
    const existing = await this.prisma.warehouseReceipt.findFirst({ where: { shipmentId } });
    if (existing) return existing;
    return this.prisma.warehouseReceipt.create({
      data: {
        shipmentId,
        receiptNumber: `WR-${shipmentNumber}`,
        arrivalDate: new Date(),
      },
    });
  }

  private async getPoOrThrow(inquiryId: string, poId: string) {
    const pos = await this.getInquiryPosOrThrow(inquiryId);
    const po = pos.find((p) => p.id === poId);
    if (!po) {
      throw new NotFoundException("این PO به این پرونده تعلق نداره");
    }
    return po;
  }

  private async getOrSeedTracking(poId: string) {
    const existing = await this.prisma.productionTracking.findUnique({ where: { poId } });
    if (existing) return existing;
    return this.prisma.productionTracking.create({ data: { poId, status: "in_production" } });
  }

  private async formatEntry(
    po: { id: string; poNumber: string; supplier: { companyName: string } },
    trackingId: string,
  ) {
    const tracking = await this.prisma.productionTracking.findUnique({
      where: { id: trackingId },
      include: {
        logs: { orderBy: { logDate: "desc" } },
        po: { select: { packages: { orderBy: { createdAt: "asc" } } } },
      },
    });
    if (!tracking) throw new NotFoundException("پیگیری تولید یافت نشد");

    return {
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplier.companyName,
      status: tracking.status,
      estimatedReadyDate: tracking.estimatedReadyDate,
      pickupAddress: tracking.pickupAddress,
      pickupPhone: tracking.pickupPhone,
      pickupContactName: tracking.pickupContactName,
      pickupContactEmail: tracking.pickupContactEmail,
      pickupContactPhone: tracking.pickupContactPhone,
      logs: tracking.logs.map((l) => ({
        id: l.id,
        logDate: l.logDate,
        note: l.note,
        documentUrl: l.documentUrl,
      })),
      packages: tracking.po.packages.map((p) => ({
        id: p.id,
        packageNumber: p.packageNumber,
        lengthCm: p.lengthCm != null ? Number(p.lengthCm) : null,
        widthCm: p.widthCm != null ? Number(p.widthCm) : null,
        heightCm: p.heightCm != null ? Number(p.heightCm) : null,
        weightKg: Number(p.weightKg),
        pickupLocation: p.pickupLocation,
        status: p.status,
      })),
    };
  }
}
