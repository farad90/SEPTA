import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { ActivitiesService } from "../activities/activities.service";
import { ShipmentsService } from "./shipments.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const APPROVER_ID = "44444444-4444-4444-4444-444444444444";
const SHIPMENT_ID = "22222222-2222-2222-2222-222222222222";
const PKG_A = "33333333-3333-3333-3333-333333333333";

function buildPrisma() {
  return {
    shipment: { findUnique: jest.fn(), update: jest.fn() },
    exportDocument: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    importDocument: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    shipmentDocument: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
    shipmentEditRequest: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    package: { findMany: jest.fn().mockResolvedValue([]) },
    activity: { findFirst: jest.fn().mockResolvedValue(null) },
    inquiry: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ salesExpertId: "sales-1", procurementOwnerId: "proc-1" }),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>, approverIds: string[] = [APPROVER_ID]) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const permissions = {
    hasPermission: jest.fn(async (userId: string, key: string) =>
      key === "shipping.approve_edit" ? approverIds.includes(userId) : false,
    ),
  };
  const activities = {
    openStageActivity: jest.fn().mockResolvedValue({}),
    closeStageActivities: jest.fn().mockResolvedValue(0),
  };
  const service = new ShipmentsService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
    notifications as unknown as NotificationsService,
    permissions as unknown as PermissionsService,
    activities as unknown as ActivitiesService,
  );
  return { service, activityLog, notifications, permissions, activities };
}

function baseShipment(stage: string, extra: Record<string, unknown> = {}) {
  return {
    id: SHIPMENT_ID,
    shipmentNumber: "SHP-2026-0001",
    stage,
    unlockedStage: null,
    freightCompany: { id: "fc-1", companyName: "DHL", country: "DE" },
    commercialExpert: { id: USER_ID, fullName: "کارشناس" },
    selectedFreightOffer: null,
    destinationCustoms: "بازرگان",
    consolidationStartDate: null,
    consolidationFinalizeDate: null,
    billOfLadingNumber: null,
    loadingDate: null,
    eta: null,
    exportDeclarationNumber: null,
    customsDeclarationNumber: null,
    customsDutiesAmount: null,
    clearanceFeesAmount: null,
    clearanceAgentName: null,
    packages: [{ packageId: PKG_A, package: { id: PKG_A, packageNumber: "بسته 1", weightKg: "10", po: { poNumber: "PO-1" } } }],
    exportDocuments: { id: "ed-1", invoiceNumber: null, packingListNumber: null, status: "preparing" },
    importDocuments: { id: "id-1", insuranceAmount: null },
    documents: [],
    editRequests: [],
    ...extra,
  };
}

describe("ShipmentsService — پیشروی یک‌طرفه مرحله", () => {
  it("moves consolidating → in_transit, clears unlockedStage, and logs activity", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("consolidating"));
    prisma.package.findMany.mockResolvedValue([{ po: { order: { inquiryId: "inq-1" } } }]);
    const { service, activityLog } = buildService(prisma);

    await service.advance(SHIPMENT_ID, USER_ID);

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: "in_transit", unlockedStage: null }) }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ inquiryId: "inq-1", tag: "status_change" }),
    );
  });

  it("فاز ۵۸: رسیدن به cleared، shipping_in_progress رو می‌بنده و delivery_pending رو برای Sales Owner باز می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("customs_declared"));
    prisma.package.findMany.mockResolvedValue([{ po: { order: { inquiryId: "inq-1" } } }]);
    const { service, activities } = buildService(prisma);

    await service.advance(SHIPMENT_ID, USER_ID);

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: "cleared" }) }),
    );
    expect(activities.closeStageActivities).toHaveBeenCalledWith("inq-1", "shipping_in_progress", USER_ID);
    expect(activities.openStageActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: "inq-1",
        stageCode: "delivery_pending",
        assignedToUserId: "sales-1",
        extraWatcherUserIds: ["proc-1"],
      }),
    );
  });

  it("فاز ۵۸: عبور بین مراحل میانی (نه رسیدن به cleared) delivery_pending باز نمی‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("export_declared"));
    prisma.package.findMany.mockResolvedValue([{ po: { order: { inquiryId: "inq-1" } } }]);
    const { service, activities } = buildService(prisma);

    await service.advance(SHIPMENT_ID, USER_ID);

    expect(activities.openStageActivity).not.toHaveBeenCalled();
  });

  it("rejects advancing past the last stage (cleared)", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("cleared"));
    const { service } = buildService(prisma);

    await expect(service.advance(SHIPMENT_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFound for an unknown shipment", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.advance("missing", USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ShipmentsService — قفل مرحله (فاز ۲۷)", () => {
  it("rejects editing an in_transit field once the shipment has moved past it (non-approver)", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("export_declared"));
    const { service } = buildService(prisma);

    await expect(
      service.update(SHIPMENT_ID, { billOfLadingNumber: "BL-1" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows editing the current stage's fields", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("in_transit"));
    const { service } = buildService(prisma);

    await service.update(SHIPMENT_ID, { billOfLadingNumber: "BL-1" }, USER_ID);

    expect(prisma.shipment.update).toHaveBeenCalled();
  });

  it("allows an approve_edit holder to edit a locked stage directly", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("export_declared"));
    const { service } = buildService(prisma);

    await service.update(SHIPMENT_ID, { billOfLadingNumber: "BL-1" }, APPROVER_ID);

    expect(prisma.shipment.update).toHaveBeenCalled();
  });

  it("allows editing a locked stage when it's temporarily unlocked", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("export_declared", { unlockedStage: "in_transit" }));
    const { service } = buildService(prisma);

    await service.update(SHIPMENT_ID, { billOfLadingNumber: "BL-1" }, USER_ID);

    expect(prisma.shipment.update).toHaveBeenCalled();
  });

  it("locks import documents once past iran_docs_sent", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("customs_declared"));
    const { service } = buildService(prisma);

    await expect(
      service.updateImportDocuments(SHIPMENT_ID, { insurancePolicyNumber: "X" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ShipmentsService — اسناد چندفایلی (فاز ۲۷)", () => {
  it("adds a document to an editable stage and recomputes export status", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("in_transit"));
    prisma.exportDocument.findUnique.mockResolvedValue({ id: "ed-1", status: "preparing" });
    prisma.shipmentDocument.groupBy.mockResolvedValue([
      { docKey: "export_invoice" },
      { docKey: "export_packing_list" },
      { docKey: "non_dual_use" },
      { docKey: "power_of_attorney" },
    ]);
    const { service } = buildService(prisma);

    await service.addDocument(SHIPMENT_ID, { docKey: "export_invoice", fileUrl: "2026/07/a.pdf" }, USER_ID);

    expect(prisma.shipmentDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ shipmentId: SHIPMENT_ID, docKey: "export_invoice", uploadedBy: USER_ID }),
    });
    expect(prisma.exportDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "complete" }) }),
    );
  });

  it("rejects adding a document to a locked stage (non-approver)", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("cleared"));
    const { service } = buildService(prisma);

    await expect(
      service.addDocument(SHIPMENT_ID, { docKey: "export_invoice", fileUrl: "x" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects removing a document from a locked stage (non-approver)", async () => {
    const prisma = buildPrisma();
    prisma.shipmentDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      shipmentId: SHIPMENT_ID,
      docKey: "export_invoice",
      shipment: baseShipment("cleared"),
    });
    const { service } = buildService(prisma);

    await expect(service.removeDocument("doc-1", USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("ShipmentsService — درخواست اصلاح (فاز ۲۷)", () => {
  it("creates a request for a locked stage and notifies approvers with action buttons", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("customs_declared"));
    prisma.shipmentEditRequest.findFirst.mockResolvedValue(null);
    prisma.shipmentEditRequest.create.mockResolvedValue({
      id: "req-1",
      requester: { fullName: "کارشناس" },
    });
    prisma.user.findMany.mockResolvedValue([{ id: APPROVER_ID }]);
    const { service, notifications } = buildService(prisma);

    await service.createEditRequest(SHIPMENT_ID, { stage: "in_transit", reason: "شماره بارنامه اشتباه بود" }, USER_ID);

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: APPROVER_ID,
        type: "shipment_edit_request",
        relatedEntityType: "shipment_edit_request",
        relatedEntityId: "req-1",
        actions: [
          { label: "تأیید", action: "approve" },
          { label: "رد", action: "reject" },
        ],
      }),
    );
  });

  it("rejects requesting an edit for a stage that is not locked", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("in_transit"));
    const { service } = buildService(prisma);

    await expect(
      service.createEditRequest(SHIPMENT_ID, { stage: "in_transit", reason: "دلیل" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a second request while one is still pending", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("customs_declared"));
    prisma.shipmentEditRequest.findFirst.mockResolvedValue({ id: "req-0", status: "pending" });
    const { service } = buildService(prisma);

    await expect(
      service.createEditRequest(SHIPMENT_ID, { stage: "in_transit", reason: "دلیل" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("approve unlocks the requested stage and notifies the requester", async () => {
    const prisma = buildPrisma();
    prisma.shipmentEditRequest.findUnique.mockResolvedValue({
      id: "req-1",
      shipmentId: SHIPMENT_ID,
      stage: "in_transit",
      status: "pending",
      requestedBy: USER_ID,
      shipment: baseShipment("customs_declared"),
    });
    const { service, notifications } = buildService(prisma);

    await service.decideEditRequest("req-1", "approved", APPROVER_ID);

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unlockedStage: "in_transit" }) }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, type: "shipment_edit_decided" }),
    );
  });

  it("reject does not unlock and still notifies the requester", async () => {
    const prisma = buildPrisma();
    prisma.shipmentEditRequest.findUnique.mockResolvedValue({
      id: "req-1",
      shipmentId: SHIPMENT_ID,
      stage: "in_transit",
      status: "pending",
      requestedBy: USER_ID,
      shipment: baseShipment("customs_declared"),
    });
    const { service, notifications } = buildService(prisma);

    await service.decideEditRequest("req-1", "rejected", APPROVER_ID);

    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, type: "shipment_edit_decided" }),
    );
  });

  it("rejects deciding an already-decided request", async () => {
    const prisma = buildPrisma();
    prisma.shipmentEditRequest.findUnique.mockResolvedValue({
      id: "req-1",
      status: "approved",
      shipment: baseShipment("customs_declared"),
    });
    const { service } = buildService(prisma);

    await expect(service.decideEditRequest("req-1", "approved", APPROVER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("relock by the original requester clears unlockedStage", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("customs_declared", { unlockedStage: "in_transit" }));
    prisma.shipmentEditRequest.findFirst.mockResolvedValue({ id: "req-1", requestedBy: USER_ID });
    const { service } = buildService(prisma);

    await service.relock(SHIPMENT_ID, USER_ID);

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unlockedStage: null }) }),
    );
  });

  it("relock by an unrelated non-approver is forbidden", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("customs_declared", { unlockedStage: "in_transit" }));
    prisma.shipmentEditRequest.findFirst.mockResolvedValue({ id: "req-1", requestedBy: "someone-else" });
    const { service } = buildService(prisma);

    await expect(service.relock(SHIPMENT_ID, USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("ShipmentsService — seed خودکار اسناد صادرات/واردات", () => {
  it("seeds export_documents and import_documents on first GET", async () => {
    const prisma = buildPrisma();
    const shipmentWithoutDocs = { ...baseShipment("consolidating"), exportDocuments: null, importDocuments: null };
    prisma.shipment.findUnique
      .mockResolvedValueOnce(shipmentWithoutDocs)
      .mockResolvedValueOnce(baseShipment("consolidating"));
    prisma.exportDocument.findUnique.mockResolvedValue(null);
    prisma.exportDocument.create.mockResolvedValue({ id: "ed-1" });
    prisma.importDocument.findUnique.mockResolvedValue(null);
    prisma.importDocument.create.mockResolvedValue({ id: "id-1" });
    const { service } = buildService(prisma);

    await service.getById(SHIPMENT_ID);

    expect(prisma.exportDocument.create).toHaveBeenCalledWith({ data: { shipmentId: SHIPMENT_ID } });
    expect(prisma.importDocument.create).toHaveBeenCalledWith({ data: { shipmentId: SHIPMENT_ID } });
  });
});

describe("ShipmentsService — وضعیت complete مدارک صادراتی از جدول جدید (فاز ۲۷)", () => {
  it("stays preparing while any of the 4 export slots has no file", async () => {
    const prisma = buildPrisma();
    prisma.shipment.findUnique.mockResolvedValue(baseShipment("in_transit"));
    prisma.exportDocument.findUnique.mockResolvedValue({ id: "ed-1", status: "preparing" });
    prisma.shipmentDocument.groupBy.mockResolvedValue([
      { docKey: "export_invoice" },
      { docKey: "export_packing_list" },
    ]);
    const { service } = buildService(prisma);

    await service.updateExportDocuments(SHIPMENT_ID, { invoiceNumber: "INV-1" }, USER_ID);

    expect(prisma.exportDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "preparing" }) }),
    );
  });
});
