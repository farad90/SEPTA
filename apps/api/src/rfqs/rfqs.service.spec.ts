import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { MailService } from "../mail/mail.service";
import { RfqNumberService } from "./rfq-number.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ActivitiesService } from "../activities/activities.service";
import { InquiriesService } from "../inquiries/inquiries.service";
import { RfqsService } from "./rfqs.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const INQUIRY_ID = "22222222-2222-2222-2222-222222222222";
const SUPPLIER_ID = "33333333-3333-3333-3333-333333333333";
const ENTITY_ID = "44444444-4444-4444-4444-444444444444";
const RFQ_ID = "55555555-5555-5555-5555-555555555555";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn() },
    businessPartner: { findUnique: jest.fn() },
    ourEntity: { findUnique: jest.fn(), findMany: jest.fn() },
    inquiryItem: { count: jest.fn(), findMany: jest.fn() },
    // فاز ۵۸ — count پیش‌فرض ۰ می‌ده تا advanceProcurementStage در تست‌های قبلی (که به Trigger
    // #۲ کاری ندارن) زودهنگام return بشه، بدون نیاز به mock کردن هرکدوم جداگانه
    supplierRfq: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    supplierOffer: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    supplierOfferItem: { deleteMany: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
    supplierOfferDocument: { create: jest.fn() },
    rfqItem: { findMany: jest.fn() },
    inquiryDiscussion: { create: jest.fn() },
    activity: { findFirst: jest.fn().mockResolvedValue(null) },
    currency: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>, mailConfigured = false) {
  const numberService = { nextNumber: jest.fn().mockResolvedValue("RFQ-2026-0001") };
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const mail = {
    isConfigured: jest.fn().mockReturnValue(mailConfigured),
    send: jest.fn().mockResolvedValue(mailConfigured),
  };
  const config = { get: jest.fn().mockReturnValue(7) };
  const notifications = { create: jest.fn().mockResolvedValue({}), clearForEntity: jest.fn().mockResolvedValue({}) };
  const activities = {
    create: jest.fn().mockResolvedValue({}),
    openStageActivity: jest.fn().mockResolvedValue({}),
    closeStageActivities: jest.fn().mockResolvedValue(0),
  };
  const inquiries = { autoAssignProcurementOwner: jest.fn().mockResolvedValue(undefined) };
  const service = new RfqsService(
    prisma as unknown as PrismaService,
    numberService as unknown as RfqNumberService,
    activityLog as unknown as ActivityLogService,
    mail as unknown as MailService,
    config as unknown as ConfigService,
    notifications as unknown as NotificationsService,
    activities as unknown as ActivitiesService,
    inquiries as unknown as InquiriesService,
  );
  return { service, numberService, activityLog, mail, notifications, activities, inquiries };
}

const BASE_RFQ = {
  id: RFQ_ID,
  rfqNumber: "RFQ-2026-0001",
  inquiryId: INQUIRY_ID,
  status: "awaiting_response",
  emailSubject: "INQ-2026-0001",
  responseDueDate: null,
  commercialExpertId: USER_ID,
  supplier: { id: SUPPLIER_ID, companyName: "SKF", country: "NL", email: "s@x.com" },
  ourEntity: { id: ENTITY_ID, entityName: "General Trading srl", shortCode: "GT" },
  commercialExpert: { id: USER_ID, fullName: "کارشناس", email: "e@x.com" },
  items: [
    {
      inquiryItemId: "item-1",
      inquiryItem: { id: "item-1", rowIndex: 1, itemCode: "BRG", description: "بلبرینگ", quantity: "10", measurementUnit: "عدد", partNumber: null, builder: null },
    },
  ],
  offers: [],
};

describe("RfqsService", () => {
  it("rejects a supplier whose partner_type is customer-only", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, internalNumber: "INQ-2026-0001" });
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "customer", companyName: "X", status: "active" });
    const { service } = buildService(prisma);

    await expect(
      service.create(INQUIRY_ID, { supplierId: SUPPLIER_ID, ourEntityId: ENTITY_ID, inquiryItemIds: ["item-1"], recipientEmail: "a@b.com" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects items that do not belong to the inquiry", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, internalNumber: "INQ-2026-0001" });
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "supplier", companyName: "X", status: "active" });
    prisma.ourEntity.findUnique.mockResolvedValue({ id: ENTITY_ID, status: "active", entityName: "GT" });
    prisma.inquiryItem.count.mockResolvedValue(0); // هیچ‌کدوم مال این پرونده نیست
    const { service } = buildService(prisma);

    await expect(
      service.create(INQUIRY_ID, { supplierId: SUPPLIER_ID, ourEntityId: ENTITY_ID, inquiryItemIds: ["foreign-item"], recipientEmail: "a@b.com" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create() never sends email itself — فاز ۳۳: فقط رکورد رو می‌سازه، ارسال یک اکشن جدای بعدیه", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({ id: INQUIRY_ID, internalNumber: "INQ-2026-0001" });
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "both", companyName: "SKF", status: "active" });
    prisma.ourEntity.findUnique.mockResolvedValue({ id: ENTITY_ID, status: "active", entityName: "GT" });
    prisma.inquiryItem.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ supplierRfq: { create: jest.fn().mockResolvedValue(BASE_RFQ) } }),
    );
    const { service, activityLog, mail, notifications } = buildService(prisma, false);

    const result = await service.create(
      INQUIRY_ID,
      { supplierId: SUPPLIER_ID, ourEntityId: ENTITY_ID, inquiryItemIds: ["item-1"], recipientEmail: "a@b.com" },
      USER_ID,
    );

    expect(result).not.toHaveProperty("emailSent");
    expect(mail.send).not.toHaveBeenCalled();
    // با ثبت اولین RFQ، یادآوری روزانه «بدون RFQ» برای این پرونده بلافاصله پاک می‌شه
    expect(notifications.clearForEntity).toHaveBeenCalledWith(
      "inquiry",
      INQUIRY_ID,
      "inquiry_awaiting_supplier_rfq",
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "stage_completed", sourceRfqId: RFQ_ID, text: expect.stringContaining("ثبت شد") }),
    );
    // فاز ۳۴ — نسخه‌ی محدود (بدون نام تأمین‌کننده) باید هم‌زمان پاس داده بشه
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        restrictedText: expect.not.stringContaining("SKF"),
      }),
    );
  });

  it("resendEmail() rejects when SMTP isn't configured — کاربر باید از پیش‌نمایش دستی کپی کنه", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    const { service, mail } = buildService(prisma, false);

    await expect(service.resendEmail(RFQ_ID, "a@b.com", USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("resendEmail() sends and logs the activity when SMTP is configured — این همون اکشن «ارسال» فاز ۳۳ـه", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    const { service, mail, activityLog } = buildService(prisma, true);

    const result = await service.resendEmail(RFQ_ID, "a@b.com", USER_ID);

    expect(result).toEqual({ success: true });
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.com" }));
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ sourceRfqId: RFQ_ID, text: expect.stringContaining("ارسال شد") }),
    );
  });

  it("technical question flips status and inserts a discussion with source_rfq_id + sales-expert mention", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({ salesExpertId: "sales-expert-id" });
    prisma.supplierRfq.update.mockResolvedValue({ ...BASE_RFQ, status: "technical_question" });
    const { service } = buildService(prisma);

    await service.recordTechnicalQuestion(RFQ_ID, { questionText: "جنس بدنه چیه؟" }, USER_ID);

    expect(prisma.supplierRfq.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "technical_question" }) }),
    );
    expect(prisma.inquiryDiscussion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tag: "technical_question",
          sourceRfqId: RFQ_ID,
          mentionedUserId: "sales-expert-id",
        }),
      }),
    );
  });

  it("recordRejection() flips status to rejected_by_supplier and stores the reason + logs a restricted-safe activity", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.supplierRfq.update.mockResolvedValue({
      ...BASE_RFQ,
      status: "rejected_by_supplier",
      rejectionReason: "قیمت تمام‌شده اقتصادی نیست",
    });
    const { service, activityLog } = buildService(prisma);

    const result = await service.recordRejection(
      RFQ_ID,
      { reason: "قیمت تمام‌شده اقتصادی نیست" },
      USER_ID,
    );

    expect(result.status).toBe("rejected_by_supplier");
    expect(prisma.supplierRfq.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected_by_supplier",
          rejectionReason: "قیمت تمام‌شده اقتصادی نیست",
        }),
      }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "status_change", sourceRfqId: RFQ_ID, text: expect.stringContaining("رد شد") }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ restrictedText: expect.not.stringContaining("SKF") }),
    );
  });

  it("rejects offer items outside the RFQ item set", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    const { service } = buildService(prisma);

    await expect(
      service.createOffer(RFQ_ID, { currencyCode: "EUR", items: [{ inquiryItemId: "not-in-rfq", price: 5 }] }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createOffer() سازد و لاگ‌های کامل/محدود جدا رو ثبت می‌کنه — فاز ۳۴", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplierOffer: { create: jest.fn().mockResolvedValue({ id: "offer-1" }) },
        supplierRfq: { update: jest.fn().mockResolvedValue({}) },
      }),
    );
    const { service, activityLog } = buildService(prisma);

    await service.createOffer(RFQ_ID, { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 5 }] }, USER_ID);

    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("SKF"),
        restrictedText: expect.not.stringContaining("SKF"),
      }),
    );
  });

  it("فاز ۵۸: createOffer() وقتی آخرین RFQ به سرانجام می‌رسه، procurement_awaiting_response رو می‌بنده و pricing_pending رو با مالک تأمین باز می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({
      selectionLockedAt: null,
      salesExpertId: "sales-1",
      procurementOwnerId: "proc-1",
    });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    // فراخوانی اول (remaining) صفر → هیچ RFQ دیگه‌ای در انتظار نیست؛ فراخوانی دوم (totalRfqs) یک
    prisma.supplierRfq.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplierOffer: { create: jest.fn().mockResolvedValue({ id: "offer-1" }) },
        supplierRfq: { update: jest.fn().mockResolvedValue({}) },
      }),
    );
    const { service, activities } = buildService(prisma);

    await service.createOffer(
      RFQ_ID,
      { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 5 }] },
      USER_ID,
    );

    expect(activities.closeStageActivities).toHaveBeenCalledWith(
      INQUIRY_ID,
      "procurement_awaiting_response",
      USER_ID,
    );
    expect(activities.openStageActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiryId: INQUIRY_ID,
        stageCode: "pricing_pending",
        assignedToUserId: "proc-1",
        extraWatcherUserIds: ["sales-1"],
      }),
    );
  });

  it("فاز ۵۸: createOffer() وقتی هنوز RFQ دیگه‌ای در انتظار پاسخه، pricing_pending رو باز نمی‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.supplierRfq.count.mockResolvedValueOnce(1); // یک RFQ دیگه هنوز awaiting_response‌ست
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplierOffer: { create: jest.fn().mockResolvedValue({ id: "offer-1" }) },
        supplierRfq: { update: jest.fn().mockResolvedValue({}) },
      }),
    );
    const { service, activities } = buildService(prisma);

    await service.createOffer(
      RFQ_ID,
      { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 5 }] },
      USER_ID,
    );

    expect(activities.openStageActivity).not.toHaveBeenCalledWith(
      expect.objectContaining({ stageCode: "pricing_pending" }),
    );
  });

  it("فاز ۵۵: createOffer() برند سازنده‌ی وارد‌شده برای هر قلم رو ذخیره می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    const create = jest.fn().mockResolvedValue({ id: "offer-1" });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplierOffer: { create },
        supplierRfq: { update: jest.fn().mockResolvedValue({}) },
      }),
    );
    const { service } = buildService(prisma);

    await service.createOffer(
      RFQ_ID,
      { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 5, builder: "Siemens" }] },
      USER_ID,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [expect.objectContaining({ builder: "Siemens" })] },
        }),
      }),
    );
  });

  it("blocks offers after the selection stage is locked", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: new Date() });
    const { service } = buildService(prisma);

    await expect(
      service.createOffer(RFQ_ID, { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 5 }] }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("marks overdue awaiting RFQs as no_response with an activity entry", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findMany.mockResolvedValue([
      { ...BASE_RFQ, supplier: { companyName: "SKF" } },
    ]);
    prisma.supplierRfq.update.mockResolvedValue({});
    const { service, activityLog } = buildService(prisma);

    const count = await service.markOverdueAsNoResponse(new Date("2026-08-01"));

    expect(count).toBe(1);
    expect(prisma.supplierRfq.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "no_response" }) }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "status_change", metadata: expect.objectContaining({ action: "auto_no_response" }) }),
    );
  });

  it("updateOffer() editing an offer whose item is already selected in Selection does not throw", async () => {
    const prisma = buildPrisma();
    const offerId = "offer-1";
    prisma.supplierOffer.findUnique.mockResolvedValue({
      id: offerId,
      rfqId: RFQ_ID,
      rfq: {
        inquiryId: INQUIRY_ID,
        rfqNumber: "RFQ-2026-0001",
        supplier: { companyName: "SKF" },
      },
    });
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null });
    prisma.rfqItem.findMany.mockResolvedValue([{ inquiryItemId: "item-1" }]);
    // این ردیف الان توسط inquiry_items.selected_offer_item_id ارجاع داده شده (انتخاب‌شده در
    // مرحله انتخاب نهایی) — همون سناریوی باگ. چون قلمش (inquiryItemId) در dto.items هم هست
    // (فقط قیمتش عوض شده)، نباید حذف بشه و نباید FK بشکنه.
    prisma.supplierOfferItem.findMany.mockResolvedValue([
      { id: "offer-item-1", inquiryItemId: "item-1" },
    ]);
    prisma.$transaction.mockResolvedValue([]);
    prisma.supplierRfq.findUnique.mockResolvedValue(BASE_RFQ);
    const { service } = buildService(prisma);

    await expect(
      service.updateOffer(
        offerId,
        { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 7 }] },
        USER_ID,
      ),
    ).resolves.toBeDefined();

    // به‌جای deleteMany همه‌ی ردیف‌ها، باید همون ردیف موجود سرجاش upsert بشه — ID و در نتیجه
    // FK از inquiry_items.selected_offer_item_id دست‌نخورده می‌مونه
    expect(prisma.supplierOfferItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.supplierOfferItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { offerId_inquiryItemId: { offerId, inquiryItemId: "item-1" } },
      }),
    );
    // چون هیچ قلمی حذف نشده، نباید حتی چک انتخاب‌شدن رو صدا بزنه
    expect(prisma.inquiryItem.findMany).not.toHaveBeenCalled();
  });

  it("updateOffer() blocks removing an offer item that is still selected in Selection", async () => {
    const prisma = buildPrisma();
    const offerId = "offer-1";
    prisma.supplierOffer.findUnique.mockResolvedValue({
      id: offerId,
      rfqId: RFQ_ID,
      rfq: {
        inquiryId: INQUIRY_ID,
        rfqNumber: "RFQ-2026-0001",
        supplier: { companyName: "SKF" },
      },
    });
    prisma.inquiry.findUnique.mockResolvedValue({ selectionLockedAt: null });
    prisma.rfqItem.findMany.mockResolvedValue([
      { inquiryItemId: "item-1" },
      { inquiryItemId: "item-2" },
    ]);
    prisma.supplierOfferItem.findMany.mockResolvedValue([
      { id: "offer-item-1", inquiryItemId: "item-1" },
      { id: "offer-item-2", inquiryItemId: "item-2" },
    ]);
    // item-2 از dto.items حذف شده (کاربر ردیفش رو از فرم برداشته) ولی هنوز در مرحله انتخاب
    // نهایی انتخاب شده — باید با یک خطای قابل‌فهم رد بشه، نه یک 500 خام از Prisma
    prisma.inquiryItem.findMany.mockResolvedValue([{ id: "item-2" }]);
    const { service } = buildService(prisma);

    await expect(
      service.updateOffer(
        offerId,
        { currencyCode: "EUR", items: [{ inquiryItemId: "item-1", price: 7 }] },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("computes offer totals (subtotal + VAT + other costs)", async () => {
    const prisma = buildPrisma();
    prisma.supplierRfq.findMany.mockResolvedValue([
      {
        ...BASE_RFQ,
        offers: [
          {
            items: [{ inquiryItemId: "item-1", price: "5.5" }],
            vatApplicable: true,
            vatRatePercent: "10",
            otherCosts: "3",
            documents: [],
          },
        ],
      },
    ]);
    const { service } = buildService(prisma);

    const [rfq] = await service.listForInquiry(INQUIRY_ID);

    // 5.5 × ۱۰ عدد = ۵۵ + ۱۰٪ VAT (۵.۵) + ۳ = ۶۳.۵
    expect(rfq.offers[0].totals).toEqual({ subTotal: 55, vatAmount: 5.5, otherCosts: 3, grandTotal: 63.5 });
  });
});
