import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "./activity-log.service";
import { InquiriesService } from "./inquiries.service";
import { InquiryNumberService } from "./inquiry-number.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { CreateInquiryDto } from "./dto/inquiry.dto";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const BUYER_ID = "22222222-2222-2222-2222-222222222222";

function buildPrisma() {
  return {
    inquiry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inquiryItem: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    inquiryItemDocument: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    inquiryDiscussion: { findMany: jest.fn(), create: jest.fn() },
    businessPartner: { findUnique: jest.fn() },
    partnerContact: { findUnique: jest.fn() },
    itemCatalog: { findMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    supplierRfq: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const numberService = { nextNumber: jest.fn().mockResolvedValue("INQ-2026-0001") };
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const notifications = { create: jest.fn().mockResolvedValue({}), clearForEntity: jest.fn().mockResolvedValue({}) };
  const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
  const service = new InquiriesService(
    prisma as unknown as PrismaService,
    numberService as unknown as InquiryNumberService,
    activityLog as unknown as ActivityLogService,
    notifications as unknown as NotificationsService,
    permissions as unknown as PermissionsService,
  );
  return { service, numberService, activityLog, notifications, permissions };
}

const BASE_DTO: CreateInquiryDto = {
  buyerId: BUYER_ID,
  subject: "تأمین یاتاقان",
  offerEndDate: "2026-08-01",
  inquiryStartDate: "2026-07-08",
  items: [
    { itemCode: "BRG-6205", description: "بلبرینگ", quantity: 10, measurementUnit: "عدد" },
  ],
};

describe("InquiriesService — قوانین کسب‌وکاری", () => {
  it("rejects a buyer whose partner_type is not customer/both", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({
      partnerType: "supplier",
      status: "active",
    });
    const { service } = buildService(prisma);

    await expect(service.create(BASE_DTO, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects item codes that are missing from the catalog", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({
      partnerType: "customer",
      status: "active",
    });
    prisma.itemCatalog.findMany.mockResolvedValue([]); // هیچ کدی در کاتالوگ نیست
    const { service } = buildService(prisma);

    await expect(service.create(BASE_DTO, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a buyer contact that belongs to another company", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({
      partnerType: "customer",
      status: "active",
    });
    prisma.partnerContact.findUnique.mockResolvedValue({ partnerId: "other-company" });
    const { service } = buildService(prisma);

    await expect(
      service.create(
        { ...BASE_DTO, buyerContactId: "33333333-3333-3333-3333-333333333333" },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates the inquiry inside a transaction and logs a stage_completed activity", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({
      partnerType: "both",
      status: "active",
    });
    prisma.itemCatalog.findMany.mockResolvedValue([{ itemCode: "BRG-6205" }]);
    const created = { id: "inq-1", internalNumber: "INQ-2026-0001" };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { inquiry: { create: jest.fn().mockResolvedValue(created) } };
      return fn(tx);
    });
    const { service, activityLog } = buildService(prisma);

    const result = await service.create(BASE_DTO, USER_ID);

    expect(result).toEqual(created);
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ inquiryId: "inq-1", tag: "stage_completed" }),
    );
  });

  it("notifies every user with rfq.view after creating a new inquiry", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "both", status: "active" });
    prisma.itemCatalog.findMany.mockResolvedValue([{ itemCode: "BRG-6205" }]);
    const created = { id: "inq-1", internalNumber: "INQ-2026-0001", subject: BASE_DTO.subject };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ inquiry: { create: jest.fn().mockResolvedValue(created) } }),
    );
    prisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    const { service, notifications } = buildService(prisma);

    await service.create(BASE_DTO, USER_ID);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          permissionGroup: { items: { some: { permission: { permissionKey: "rfq.view" } } } },
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "inquiry_awaiting_supplier_rfq",
        relatedEntityType: "inquiry",
        relatedEntityId: "inq-1",
      }),
    );
  });

  it("remindPendingSupplierRfqs() clears yesterday's notification before re-issuing for still-pending inquiries", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findMany.mockResolvedValue([
      { id: "inq-1", internalNumber: "INQ-2026-0001", subject: "تأمین یاتاقان" },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
    const { service, notifications } = buildService(prisma);

    const count = await service.remindPendingSupplierRfqs();

    expect(count).toBe(1);
    expect(prisma.inquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "in_progress", rfqs: { none: {} } }),
      }),
    );
    expect(notifications.clearForEntity).toHaveBeenCalledWith(
      "inquiry",
      "inq-1",
      "inquiry_awaiting_supplier_rfq",
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", relatedEntityId: "inq-1" }),
    );
  });

  it("blocks removing the last remaining item", async () => {
    const prisma = buildPrisma();
    prisma.inquiryItem.findUnique.mockResolvedValue({
      id: "item-1",
      inquiryId: "inq-1",
      itemCode: "BRG-6205",
    });
    prisma.inquiryItem.count.mockResolvedValue(1);
    const { service } = buildService(prisma);

    await expect(service.removeItem("item-1", USER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("logs a status_change activity when status changes", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: "inq-1",
      status: "in_progress",
      buyerId: BUYER_ID,
      salesExpert: { fullName: "x" },
    });
    prisma.inquiry.update.mockResolvedValue({ id: "inq-1", status: "suspended" });
    const { service, activityLog } = buildService(prisma);

    await service.update("inq-1", { status: "suspended" }, USER_ID);

    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "status_change" }),
    );
  });

  it("throws NotFound for a missing inquiry", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("InquiriesService — سطل حذف (soft delete)", () => {
  it("remove() sets deletedAt/deletedBy instead of deleting the row", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: null });
    const { service } = buildService(prisma);

    const result = await service.remove("inq-1", USER_ID);

    expect(prisma.inquiry.delete).not.toHaveBeenCalled();
    expect(prisma.inquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inq-1" },
        data: expect.objectContaining({ deletedBy: USER_ID }),
      }),
    );
    expect(result).toEqual({ success: true, softDeleted: true });
  });

  it("getById hides a soft-deleted inquiry unless includeDeleted is passed", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: new Date() });
    const { service } = buildService(prisma);

    await expect(service.getById("inq-1")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getById("inq-1", { includeDeleted: true })).resolves.toBeDefined();
  });

  it("restore() rejects an inquiry that isn't deleted", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: null });
    const { service } = buildService(prisma);

    await expect(service.restore("inq-1", USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("restore() clears deletedAt/deletedBy and logs an activity", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: new Date() });
    const { service, activityLog } = buildService(prisma);

    await service.restore("inq-1", USER_ID);

    expect(prisma.inquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: null, deletedBy: null } }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: "restored" }) }),
    );
  });

  it("purge() rejects an inquiry that was never soft-deleted", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: null });
    const { service } = buildService(prisma);

    await expect(service.purge("inq-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("purge() rejects a soft-deleted inquiry that still has RFQs", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: new Date() });
    prisma.supplierRfq.count.mockResolvedValue(2);
    const { service } = buildService(prisma);

    await expect(service.purge("inq-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inquiry.delete).not.toHaveBeenCalled();
  });

  it("purge() hard-deletes a soft-deleted inquiry with no RFQs", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: "inq-1", deletedAt: new Date() });
    prisma.supplierRfq.count.mockResolvedValue(0);
    const { service } = buildService(prisma);

    await service.purge("inq-1");

    expect(prisma.inquiry.delete).toHaveBeenCalledWith({ where: { id: "inq-1" } });
  });

  it("list() excludes soft-deleted inquiries by default", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findMany.mockResolvedValue([]);
    prisma.inquiry.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    const { service } = buildService(prisma);

    await service.list({}, USER_ID);

    expect(prisma.inquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it("list() derives stageLabel from rfq count and selection lock, only for in_progress", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findMany.mockResolvedValue([
      { status: "in_progress", selectionLockedAt: null, _count: { items: 1, rfqs: 0 } },
      { status: "in_progress", selectionLockedAt: null, _count: { items: 1, rfqs: 2 } },
      { status: "in_progress", selectionLockedAt: new Date(), _count: { items: 1, rfqs: 2 } },
      { status: "won", selectionLockedAt: new Date(), _count: { items: 1, rfqs: 2 } },
    ]);
    prisma.inquiry.count.mockResolvedValue(4);
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    const { service } = buildService(prisma);

    const { items } = await service.list({}, USER_ID);

    expect(items.map((i) => i.stageLabel)).toEqual([
      "ثبت استعلام",
      "استعلام از تأمین‌کنندگان",
      "پیشنهاد به مشتری",
      null,
    ]);
  });
});

describe("InquiriesService — P0-E3-F2-T3: محدودسازی دسترسی بر مبنای مالکیت", () => {
  const OTHER_USER_ID = "44444444-4444-4444-4444-444444444444";

  it("list() بدون inquiry.view_all فقط پرونده‌های خودم رو با AND ترکیب می‌کنه (نه OR جستجو رو بازنویسی)", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findMany.mockResolvedValue([]);
    prisma.inquiry.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await service.list({ q: "بلبرینگ" }, USER_ID);

    const calledWhere = prisma.inquiry.findMany.mock.calls[0][0].where;
    // جستجوی متنی (OR روی چند فیلد) باید دست‌نخورده بمونه، فقط به‌همراه شرط مالکیت با AND
    expect(calledWhere.AND).toHaveLength(2);
    expect(calledWhere.AND[0].OR).toEqual(expect.arrayContaining([{ internalNumber: expect.anything() }]));
    expect(calledWhere.AND[1]).toEqual({
      OR: [{ salesExpertId: USER_ID }, { createdByUserId: USER_ID }],
    });
    expect(permissions.hasPermission).toHaveBeenCalledWith(USER_ID, "inquiry.view_all");
  });

  it("list() بدون جستجوی متنی، شرط مالکیت رو مستقیم روی OR می‌ذاره", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findMany.mockResolvedValue([]);
    prisma.inquiry.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await service.list({}, USER_ID);

    const calledWhere = prisma.inquiry.findMany.mock.calls[0][0].where;
    expect(calledWhere.OR).toEqual([{ salesExpertId: USER_ID }, { createdByUserId: USER_ID }]);
    expect(calledWhere.AND).toBeUndefined();
  });

  it("list() با inquiry.view_all هیچ محدودیت مالکیتی اضافه نمی‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findMany.mockResolvedValue([]);
    prisma.inquiry.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(true);

    await service.list({}, USER_ID);

    const calledWhere = prisma.inquiry.findMany.mock.calls[0][0].where;
    expect(calledWhere.OR).toBeUndefined();
    expect(calledWhere.AND).toBeUndefined();
  });

  it("getById با currentUserId خارج از scope، NotFoundException می‌ده — نه برای غریبه‌ها متفاوت از رکورد ناموجود", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: "inq-1",
      deletedAt: null,
      salesExpertId: OTHER_USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("inq-1", { currentUserId: USER_ID })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("getById با currentUserId که salesExpert همون پرونده‌ست، دسترسی می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: "inq-1",
      deletedAt: null,
      salesExpertId: USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("inq-1", { currentUserId: USER_ID })).resolves.toBeDefined();
  });

  it("getById با currentUserId که فقط createdBy همون پرونده‌ست (نه salesExpert)، دسترسی می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: "inq-1",
      deletedAt: null,
      salesExpertId: OTHER_USER_ID,
      createdByUserId: USER_ID,
    });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("inq-1", { currentUserId: USER_ID })).resolves.toBeDefined();
  });

  it("getById با inquiry.view_all به یک پرونده‌ی غیرخودی هم دسترسی می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: "inq-1",
      deletedAt: null,
      salesExpertId: OTHER_USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(true);

    await expect(service.getById("inq-1", { currentUserId: USER_ID })).resolves.toBeDefined();
  });

  it("getById بدون currentUserId (فراخوانی‌های داخلی مثل update/assign) هیچ محدودیتی اعمال نمی‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: "inq-1",
      deletedAt: null,
      salesExpertId: OTHER_USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("inq-1")).resolves.toBeDefined();
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });
});

describe("InquiriesService — محرمانگی اطلاعات بازرگانی در گفتگو/لاگ (فاز ۳۴)", () => {
  const INQUIRY_ID = "33333333-3333-3333-3333-333333333333";
  const DISCUSSION_ROWS = [
    {
      id: "d1",
      commentText: "استعلام RFQ-2026-0024 با ۲ قلم از طریق «General Trading srl» برای «Siemens AG» ثبت شد",
      commentTextRestricted: "استعلام با ۲ قلم برای ۱ تأمین‌کننده ثبت شد",
    },
    { id: "d2", commentText: "@مدیر سیستم چطوری؟", commentTextRestricted: null },
  ];

  it("برای کاربر بدون inquiry.view_commercial_details فقط نسخه‌ی محدود رو برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, deletedAt: null });
    prisma.inquiryDiscussion.findMany.mockResolvedValue(DISCUSSION_ROWS);
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    const rows = await service.listDiscussions(INQUIRY_ID, USER_ID);

    expect(rows[0].commentText).toBe("استعلام با ۲ قلم برای ۱ تأمین‌کننده ثبت شد");
    expect(rows[0].commentText).not.toContain("Siemens AG");
    // ورودی بدون نسخه‌ی محدود (پیام آزاد کاربر) دست‌نخورده می‌مونه
    expect(rows[1].commentText).toBe("@مدیر سیستم چطوری؟");
  });

  it("برای کاربر دارای inquiry.view_commercial_details نسخه‌ی کامل رو برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, deletedAt: null });
    prisma.inquiryDiscussion.findMany.mockResolvedValue(DISCUSSION_ROWS);
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(true);

    const rows = await service.listDiscussions(INQUIRY_ID, USER_ID);

    expect(rows[0].commentText).toContain("Siemens AG");
  });
});
