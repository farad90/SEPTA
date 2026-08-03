import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import {
  AddShipmentDocumentDto,
  CreateEditRequestDto,
  ShipmentDocKey,
  UpdateExportDocumentsDto,
  UpdateImportDocumentsDto,
  UpdateShipmentDto,
} from "./dto/shipment.dto";

export const STAGE_ORDER = [
  "consolidating",
  "in_transit",
  "export_declared",
  "iran_docs_sent",
  "customs_declared",
  "cleared",
] as const;

type Stage = (typeof STAGE_ORDER)[number];

/** فاز ۲۷ — نگاشت هر جایگاه سند به مرحله‌ای که بهش تعلق داره (مبنای قفل) */
const DOC_KEY_STAGE: Record<ShipmentDocKey, Stage> = {
  export_invoice: "in_transit",
  export_packing_list: "in_transit",
  non_dual_use: "in_transit",
  power_of_attorney: "in_transit",
  export_declaration: "export_declared",
  import_invoice: "iran_docs_sent",
  import_packing_list: "iran_docs_sent",
  bill_of_lading: "iran_docs_sent",
  warehouse_slip: "iran_docs_sent",
  clearance_permit: "iran_docs_sent",
  freight_invoice_rial: "iran_docs_sent",
  freight_invoice_forex: "iran_docs_sent",
  inspection_certificate: "iran_docs_sent",
  certificate_of_origin: "iran_docs_sent",
  customs_declaration: "customs_declared",
  weighbridge_slip: "cleared",
  customs_exit_waybill: "cleared",
};

/** فاز ۲۷ — نگاشت فیلدهای UpdateShipmentDto به مرحلهٔ مربوطه (مبنای قفل) */
const SHIPMENT_FIELD_STAGE: Record<keyof UpdateShipmentDto, Stage> = {
  billOfLadingNumber: "in_transit",
  loadingDate: "in_transit",
  eta: "in_transit",
  exportDeclarationNumber: "export_declared",
  customsDeclarationNumber: "customs_declared",
  customsDutiesAmount: "cleared",
  clearanceFeesAmount: "cleared",
  clearanceAgentName: "cleared",
};

/** ۴ جایگاه صادراتی که مبنای وضعیت complete مدارک صادراتی‌ان */
const EXPORT_DOC_KEYS: ShipmentDocKey[] = [
  "export_invoice",
  "export_packing_list",
  "non_dual_use",
  "power_of_attorney",
];

const SHIPMENT_INCLUDE = {
  freightCompany: { select: { id: true, companyName: true, country: true } },
  commercialExpert: { select: { id: true, fullName: true } },
  selectedFreightOffer: { select: { id: true, price: true, currencyCode: true } },
  packages: {
    include: {
      package: {
        select: {
          id: true,
          packageNumber: true,
          weightKg: true,
          po: { select: { poNumber: true } },
        },
      },
    },
  },
  exportDocuments: { include: { attachments: true } },
  importDocuments: true,
  documents: {
    include: { uploader: { select: { id: true, fullName: true } } },
    orderBy: { uploadedAt: "asc" as const },
  },
  editRequests: {
    include: { requester: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
} satisfies import("../../generated/prisma").Prisma.ShipmentInclude;

/**
 * فاز ۱۱ — ماژول سراسری «مدیریت بارها»، بخش پیگیری محموله/گمرک. چرخه ۶مرحله‌ای یک‌طرفه.
 * فاز ۲۷ — قفل مرحله: فیلدها/اسناد مراحل عبورشده قفل می‌شن؛ ویرایش مستقیم فقط با
 * shipping.approve_edit؛ بقیه از مسیر درخواست اصلاح (تأیید از داخل اعلان) می‌رن.
 */
@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionsService,
  ) {}

  async list() {
    const shipments = await this.prisma.shipment.findMany({
      include: SHIPMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return shipments.map((s) => this.formatSummary(s));
  }

  async getById(id: string) {
    const shipment = await this.getRawOrThrow(id);
    await this.ensureDocumentsSeeded(shipment.id, shipment.exportDocuments, shipment.importDocuments);
    return this.formatDetail(await this.getRawOrThrow(id));
  }

  async update(id: string, dto: UpdateShipmentDto, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    // هر فیلد ارسالی متعلق به هر مرحله‌ای که هست، اون مرحله باید قابل‌ویرایش باشه
    const touchedStages = new Set<Stage>();
    for (const [field, stage] of Object.entries(SHIPMENT_FIELD_STAGE) as [keyof UpdateShipmentDto, Stage][]) {
      if (dto[field] !== undefined) touchedStages.add(stage);
    }
    for (const stage of touchedStages) {
      await this.assertStageEditable(shipment, stage, currentUserId);
    }

    await this.prisma.shipment.update({
      where: { id },
      data: {
        billOfLadingNumber: dto.billOfLadingNumber,
        loadingDate: dto.loadingDate ? new Date(dto.loadingDate) : undefined,
        eta: dto.eta ? new Date(dto.eta) : undefined,
        exportDeclarationNumber: dto.exportDeclarationNumber,
        customsDeclarationNumber: dto.customsDeclarationNumber,
        customsDutiesAmount: dto.customsDutiesAmount,
        clearanceFeesAmount: dto.clearanceFeesAmount,
        clearanceAgentName: dto.clearanceAgentName,
        updatedAt: new Date(),
      },
    });
    return this.getById(id);
  }

  async updateExportDocuments(id: string, dto: UpdateExportDocumentsDto, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    await this.assertStageEditable(shipment, "in_transit", currentUserId);
    const doc = await this.getOrSeedExportDocuments(id);
    await this.prisma.exportDocument.update({
      where: { id: doc.id },
      data: { ...dto, status: await this.computeExportStatus(id, doc.status) },
    });
    return this.getById(id);
  }

  async markExportDocumentsSent(id: string, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    await this.assertStageEditable(shipment, "in_transit", currentUserId);
    const doc = await this.getOrSeedExportDocuments(id);
    await this.prisma.exportDocument.update({ where: { id: doc.id }, data: { status: "sent" } });
    return this.getById(id);
  }

  async updateImportDocuments(id: string, dto: UpdateImportDocumentsDto, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    await this.assertStageEditable(shipment, "iran_docs_sent", currentUserId);
    const doc = await this.getOrSeedImportDocuments(id);
    await this.prisma.importDocument.update({
      where: { id: doc.id },
      data: {
        ...dto,
        tradeSystemRegistrationDate: dto.tradeSystemRegistrationDate
          ? new Date(dto.tradeSystemRegistrationDate)
          : undefined,
        insuranceIssueDate: dto.insuranceIssueDate ? new Date(dto.insuranceIssueDate) : undefined,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
      },
    });
    return this.getById(id);
  }

  async advance(id: string, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    const currentIndex = STAGE_ORDER.indexOf(shipment.stage as Stage);
    if (currentIndex === STAGE_ORDER.length - 1) {
      throw new BadRequestException("این محموله در آخرین مرحله (ترخیص و انبار) قرار داره");
    }
    const nextStage = STAGE_ORDER[currentIndex + 1];
    const isEnteringTransit = nextStage === "in_transit";

    await this.prisma.shipment.update({
      where: { id },
      data: {
        stage: nextStage,
        consolidationFinalizeDate: isEnteringTransit ? new Date() : undefined,
        // پیشروی مرحله، هر بازکردن موقت قبلی رو هم می‌بنده
        unlockedStage: null,
        updatedAt: new Date(),
      },
    });

    const packageIds = shipment.packages.map((p) => p.packageId);
    await this.logToInvolvedInquiries(
      packageIds,
      currentUserId,
      `محموله ${shipment.shipmentNumber} به مرحله «${this.stageLabel(nextStage)}» رفت`,
      "status_change",
      { module: "shipment", action: "stage_advanced", from: shipment.stage, to: nextStage },
    );

    return this.getById(id);
  }

  // ------------------------------------------------------------
  // فاز ۲۷ — اسناد چندفایلی
  // ------------------------------------------------------------

  async addDocument(id: string, dto: AddShipmentDocumentDto, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    await this.assertStageEditable(shipment, DOC_KEY_STAGE[dto.docKey], currentUserId);
    await this.prisma.shipmentDocument.create({
      data: {
        shipmentId: id,
        docKey: dto.docKey,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        uploadedBy: currentUserId,
      },
    });
    if (EXPORT_DOC_KEYS.includes(dto.docKey)) {
      await this.refreshExportStatus(id);
    }
    return this.getById(id);
  }

  async removeDocument(documentId: string, currentUserId: string) {
    const document = await this.prisma.shipmentDocument.findUnique({
      where: { id: documentId },
      include: { shipment: { include: SHIPMENT_INCLUDE } },
    });
    if (!document) {
      throw new NotFoundException("سند یافت نشد");
    }
    const docKey = document.docKey as ShipmentDocKey;
    await this.assertStageEditable(document.shipment, DOC_KEY_STAGE[docKey], currentUserId);
    await this.prisma.shipmentDocument.delete({ where: { id: documentId } });
    if (EXPORT_DOC_KEYS.includes(docKey)) {
      await this.refreshExportStatus(document.shipmentId);
    }
    return { success: true };
  }

  // ------------------------------------------------------------
  // فاز ۲۷ — درخواست اصلاح مرحلهٔ قفل‌شده
  // ------------------------------------------------------------

  async createEditRequest(id: string, dto: CreateEditRequestDto, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    const stageIndex = STAGE_ORDER.indexOf(dto.stage as Stage);
    if (stageIndex === -1) {
      throw new BadRequestException("مرحله نامعتبره");
    }
    const currentIndex = STAGE_ORDER.indexOf(shipment.stage as Stage);
    if (stageIndex >= currentIndex) {
      throw new BadRequestException("این مرحله قفل نشده — نیازی به درخواست اصلاح نیست");
    }
    if (shipment.unlockedStage === dto.stage) {
      throw new BadRequestException("این مرحله همین الان برای اصلاح بازه");
    }
    const pending = await this.prisma.shipmentEditRequest.findFirst({
      where: { shipmentId: id, status: "pending" },
    });
    if (pending) {
      throw new BadRequestException("برای این محموله یک درخواست اصلاح در انتظار تصمیم وجود داره");
    }

    const request = await this.prisma.shipmentEditRequest.create({
      data: { shipmentId: id, stage: dto.stage, reason: dto.reason.trim(), requestedBy: currentUserId },
      include: { requester: { select: { fullName: true } } },
    });

    // اعلان قابل‌اقدام برای همهٔ دارندگان shipping.approve_edit — اولین استفادهٔ واقعی notifications.actions
    const approvers = await this.prisma.user.findMany({
      where: {
        status: "active",
        permissionGroup: {
          items: { some: { permission: { permissionKey: "shipping.approve_edit" } } },
        },
      },
      select: { id: true },
    });
    for (const approver of approvers) {
      await this.notifications.create({
        userId: approver.id,
        type: "shipment_edit_request",
        title: `درخواست اصلاح محموله ${shipment.shipmentNumber}`,
        message: `${request.requester.fullName} درخواست اصلاح مرحله «${this.stageLabel(dto.stage)}» را دارد: ${dto.reason.trim()}`,
        relatedEntityType: "shipment_edit_request",
        relatedEntityId: request.id,
        actions: [
          { label: "تأیید", action: "approve" },
          { label: "رد", action: "reject" },
        ],
      });
    }

    return this.getById(id);
  }

  async decideEditRequest(requestId: string, decision: "approved" | "rejected", currentUserId: string) {
    const request = await this.prisma.shipmentEditRequest.findUnique({
      where: { id: requestId },
      include: { shipment: { include: SHIPMENT_INCLUDE } },
    });
    if (!request) {
      throw new NotFoundException("درخواست اصلاح یافت نشد");
    }
    if (request.status !== "pending") {
      throw new BadRequestException("این درخواست قبلاً تصمیم‌گیری شده");
    }

    await this.prisma.shipmentEditRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedBy: currentUserId, decidedAt: new Date() },
    });

    if (decision === "approved") {
      await this.prisma.shipment.update({
        where: { id: request.shipmentId },
        data: { unlockedStage: request.stage, updatedAt: new Date() },
      });
    }

    await this.notifications.create({
      userId: request.requestedBy,
      type: "shipment_edit_decided",
      title:
        decision === "approved"
          ? `درخواست اصلاح محموله ${request.shipment.shipmentNumber} تأیید شد`
          : `درخواست اصلاح محموله ${request.shipment.shipmentNumber} رد شد`,
      message:
        decision === "approved"
          ? `مرحله «${this.stageLabel(request.stage)}» برای اصلاح باز شد — بعد از اتمام، «پایان اصلاح» را بزن`
          : `درخواست اصلاح مرحله «${this.stageLabel(request.stage)}» پذیرفته نشد`,
      relatedEntityType: "shipment",
      relatedEntityId: request.shipmentId,
    });

    const packageIds = request.shipment.packages.map((p) => p.packageId);
    await this.logToInvolvedInquiries(
      packageIds,
      currentUserId,
      decision === "approved"
        ? `درخواست اصلاح مرحله «${this.stageLabel(request.stage)}» محموله ${request.shipment.shipmentNumber} تأیید شد`
        : `درخواست اصلاح مرحله «${this.stageLabel(request.stage)}» محموله ${request.shipment.shipmentNumber} رد شد`,
      "status_change",
      { module: "shipment", action: `edit_request_${decision}`, stage: request.stage },
    );

    return { success: true };
  }

  async relock(id: string, currentUserId: string) {
    const shipment = await this.getRawOrThrow(id);
    if (!shipment.unlockedStage) {
      throw new BadRequestException("مرحله بازشده‌ای برای این محموله وجود نداره");
    }
    // فقط درخواست‌دهندهٔ همون بازشدن یا دارندهٔ approve_edit می‌تونه ببنده
    const isApprover = await this.permissions.hasPermission(currentUserId, "shipping.approve_edit");
    if (!isApprover) {
      const lastApproved = await this.prisma.shipmentEditRequest.findFirst({
        where: { shipmentId: id, stage: shipment.unlockedStage, status: "approved" },
        orderBy: { decidedAt: "desc" },
      });
      if (lastApproved?.requestedBy !== currentUserId) {
        throw new ForbiddenException("فقط درخواست‌دهندهٔ اصلاح یا مدیر می‌تونه اصلاح رو پایان بده");
      }
    }

    const unlockedStage = shipment.unlockedStage;
    await this.prisma.shipment.update({
      where: { id },
      data: { unlockedStage: null, updatedAt: new Date() },
    });

    const packageIds = shipment.packages.map((p) => p.packageId);
    await this.logToInvolvedInquiries(
      packageIds,
      currentUserId,
      `اصلاح مرحله «${this.stageLabel(unlockedStage)}» محموله ${shipment.shipmentNumber} پایان یافت و مرحله دوباره قفل شد`,
      "status_change",
      { module: "shipment", action: "relocked", stage: unlockedStage },
    );

    return this.getById(id);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  /** قانون قفل فاز ۲۷: مرحلهٔ عبورشده قفله، مگر همون مرحله موقتاً باز شده باشه یا کاربر approve_edit داشته باشه */
  private async assertStageEditable(
    shipment: { stage: string; unlockedStage: string | null },
    stage: Stage,
    currentUserId: string,
  ) {
    const currentIndex = STAGE_ORDER.indexOf(shipment.stage as Stage);
    const stageIndex = STAGE_ORDER.indexOf(stage);
    const locked = stageIndex < currentIndex && shipment.unlockedStage !== stage;
    if (!locked) return;
    const isApprover = await this.permissions.hasPermission(currentUserId, "shipping.approve_edit");
    if (!isApprover) {
      throw new BadRequestException(
        `مرحله «${this.stageLabel(stage)}» قفل شده — برای ویرایش باید درخواست اصلاح ثبت کنی`,
      );
    }
  }

  /** وضعیت complete مدارک صادراتی: هر ۴ جایگاه صادراتی حداقل یک فایل در shipment_documents دارن */
  private async computeExportStatus(shipmentId: string, currentStatus: string): Promise<string> {
    if (currentStatus === "sent") return "sent";
    const docs = await this.prisma.shipmentDocument.groupBy({
      by: ["docKey"],
      where: { shipmentId, docKey: { in: EXPORT_DOC_KEYS } },
    });
    return docs.length === EXPORT_DOC_KEYS.length ? "complete" : "preparing";
  }

  private async refreshExportStatus(shipmentId: string) {
    const doc = await this.getOrSeedExportDocuments(shipmentId);
    await this.prisma.exportDocument.update({
      where: { id: doc.id },
      data: { status: await this.computeExportStatus(shipmentId, doc.status) },
    });
  }

  private async getRawOrThrow(id: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id }, include: SHIPMENT_INCLUDE });
    if (!shipment) {
      throw new NotFoundException("محموله یافت نشد");
    }
    return shipment;
  }

  private async ensureDocumentsSeeded(
    shipmentId: string,
    exportDocuments: unknown,
    importDocuments: unknown,
  ) {
    if (!exportDocuments) await this.getOrSeedExportDocuments(shipmentId);
    if (!importDocuments) await this.getOrSeedImportDocuments(shipmentId);
  }

  private async getOrSeedExportDocuments(shipmentId: string) {
    const existing = await this.prisma.exportDocument.findUnique({ where: { shipmentId } });
    if (existing) return existing;
    return this.prisma.exportDocument.create({ data: { shipmentId } });
  }

  private async getOrSeedImportDocuments(shipmentId: string) {
    const existing = await this.prisma.importDocument.findUnique({ where: { shipmentId } });
    if (existing) return existing;
    return this.prisma.importDocument.create({ data: { shipmentId } });
  }

  private async logToInvolvedInquiries(
    packageIds: string[],
    authorId: string,
    text: string,
    tag: Parameters<ActivityLogService["log"]>[0]["tag"],
    metadata: Record<string, unknown>,
  ) {
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: { po: { select: { order: { select: { inquiryId: true } } } } },
    });
    const inquiryIds = [...new Set(packages.map((p) => p.po.order.inquiryId))];
    for (const inquiryId of inquiryIds) {
      await this.activityLog.log({ inquiryId, authorId, text, tag, metadata });
    }
  }

  private stageLabel(stage: string): string {
    const labels: Record<string, string> = {
      consolidating: "تجمیع",
      in_transit: "در حال حمل",
      export_declared: "اظهارنامه صادرات",
      iran_docs_sent: "مدارک ایران ارسال شد",
      customs_declared: "اظهار گمرکی مقصد",
      cleared: "ترخیص و انبار",
    };
    return labels[stage] ?? stage;
  }

  private formatSummary(shipment: Awaited<ReturnType<ShipmentsService["getRawOrThrow"]>>) {
    return {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      freightCompany: shipment.freightCompany,
      destinationCustoms: shipment.destinationCustoms,
      stage: shipment.stage,
      packageCount: shipment.packages.length,
    };
  }

  private formatDetail(shipment: Awaited<ReturnType<ShipmentsService["getRawOrThrow"]>>) {
    return {
      ...this.formatSummary(shipment),
      commercialExpert: shipment.commercialExpert,
      selectedFreightOffer: shipment.selectedFreightOffer
        ? {
            id: shipment.selectedFreightOffer.id,
            price: Number(shipment.selectedFreightOffer.price),
            currencyCode: shipment.selectedFreightOffer.currencyCode,
          }
        : null,
      consolidationStartDate: shipment.consolidationStartDate,
      consolidationFinalizeDate: shipment.consolidationFinalizeDate,
      billOfLadingNumber: shipment.billOfLadingNumber,
      loadingDate: shipment.loadingDate,
      eta: shipment.eta,
      exportDeclarationNumber: shipment.exportDeclarationNumber,
      customsDeclarationNumber: shipment.customsDeclarationNumber,
      customsDutiesAmount: shipment.customsDutiesAmount != null ? Number(shipment.customsDutiesAmount) : null,
      clearanceFeesAmount: shipment.clearanceFeesAmount != null ? Number(shipment.clearanceFeesAmount) : null,
      clearanceAgentName: shipment.clearanceAgentName,
      unlockedStage: shipment.unlockedStage,
      packages: shipment.packages.map((p) => ({
        id: p.package.id,
        packageNumber: p.package.packageNumber,
        weightKg: Number(p.package.weightKg),
        poNumber: p.package.po.poNumber,
      })),
      // فاز ۲۷ — اسناد چندفایلی: آرایهٔ تخت، فرانت بر اساس docKey گروه‌بندی می‌کنه
      documents: shipment.documents.map((d) => ({
        id: d.id,
        docKey: d.docKey,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        uploadedAt: d.uploadedAt,
        uploader: d.uploader,
      })),
      editRequests: shipment.editRequests.map((r) => ({
        id: r.id,
        stage: r.stage,
        reason: r.reason,
        status: r.status,
        requester: r.requester,
        createdAt: r.createdAt,
      })),
      exportDocuments: shipment.exportDocuments
        ? {
            invoiceNumber: shipment.exportDocuments.invoiceNumber,
            packingListNumber: shipment.exportDocuments.packingListNumber,
            status: shipment.exportDocuments.status,
          }
        : null,
      importDocuments: shipment.importDocuments
        ? {
            ...shipment.importDocuments,
            insuranceAmount:
              shipment.importDocuments.insuranceAmount != null
                ? Number(shipment.importDocuments.insuranceAmount)
                : null,
          }
        : null,
    };
  }
}
