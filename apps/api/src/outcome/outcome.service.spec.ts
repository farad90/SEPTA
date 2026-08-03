import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { OutcomeService } from "./outcome.service";

const INQUIRY_ID = "11111111-1111-1111-1111-111111111111";
const ITEM_1 = "22222222-2222-2222-2222-222222222222";
const ITEM_2 = "33333333-3333-3333-3333-333333333333";

function buildPrisma() {
  return {
    inquiry: { findUnique: jest.fn(), update: jest.fn() },
    inquiryItemOutcome: { upsert: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const service = new OutcomeService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
  );
  return { service, activityLog };
}

function mockInquiryWithItems(prisma: ReturnType<typeof buildPrisma>, itemIds: string[]) {
  prisma.inquiry.findUnique.mockResolvedValue({
    id: INQUIRY_ID,
    deletedAt: null,
    items: itemIds.map((id) => ({ id })),
  });
}

describe("OutcomeService — قوانین کسب‌وکاری", () => {
  it("throws NotFound for a missing/deleted inquiry", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.saveOutcome(INQUIRY_ID, { mode: "won_all", decisionDate: "2026-07-10" }, "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects mixed mode without full itemResults coverage", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, [ITEM_1, ITEM_2]);
    const { service } = buildService(prisma);

    await expect(
      service.saveOutcome(
        INQUIRY_ID,
        { mode: "mixed", decisionDate: "2026-07-10", itemResults: { [ITEM_1]: "won" } },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("won_all sets every item to won and inquiry.status to won", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, [ITEM_1, ITEM_2]);
    const { service, activityLog } = buildService(prisma);
    // getOutcome (called at the end) نیاز به findUnique دوباره داره — همون mock کافیه چون فقط select می‌خونه
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      status: "won",
      deletedAt: null,
      items: [ITEM_1, ITEM_2].map((id) => ({ id, rowIndex: 1, itemCode: "X", description: "d", quantity: 1, measurementUnit: "u", outcome: null })),
    });

    await service.saveOutcome(INQUIRY_ID, { mode: "won_all", decisionDate: "2026-07-10", winReason: "قیمت خوب" }, "user-1");

    expect(prisma.inquiryItemOutcome.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.inquiryItemOutcome.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inquiryItemId: ITEM_1 },
        create: expect.objectContaining({ result: "won", winReason: "قیمت خوب" }),
      }),
    );
    expect(prisma.inquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "won" }) }),
    );
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ status: "won", mode: "won_all" }) }),
    );
  });

  it("mixed mode with a split produces partially_won", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, [ITEM_1, ITEM_2]);
    const { service } = buildService(prisma);
    prisma.inquiry.findUnique.mockResolvedValueOnce({
      id: INQUIRY_ID,
      deletedAt: null,
      items: [{ id: ITEM_1 }, { id: ITEM_2 }],
    });

    await service.saveOutcome(
      INQUIRY_ID,
      {
        mode: "mixed",
        decisionDate: "2026-07-10",
        itemResults: { [ITEM_1]: "won", [ITEM_2]: "lost" },
        lossReason: "higher_price",
        competitorName: "رقیب الف",
      },
      "user-1",
    );

    expect(prisma.inquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "partially_won" }) }),
    );
    expect(prisma.inquiryItemOutcome.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inquiryItemId: ITEM_2 },
        create: expect.objectContaining({ result: "lost", lossReason: "higher_price", competitorName: "رقیب الف" }),
      }),
    );
  });

  it("cancelled mode sets every item to cancelled and inquiry.status to cancelled", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, [ITEM_1, ITEM_2]);
    const { service } = buildService(prisma);

    await service.saveOutcome(INQUIRY_ID, { mode: "cancelled", decisionDate: "2026-07-10" }, "user-1");

    expect(prisma.inquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
    );
  });

  it("فاز ۴۶: getOutcome فقط ردیف‌های دارای selectedOfferItemId رو از Prisma می‌خواد", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue({
      id: INQUIRY_ID,
      status: "in_progress",
      deletedAt: null,
      items: [],
    });
    const { service } = buildService(prisma);

    await service.getOutcome(INQUIRY_ID);

    expect(prisma.inquiry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          items: expect.objectContaining({
            where: { selectedOfferItemId: { not: null } },
          }),
        }),
      }),
    );
  });

  it("فاز ۴۶: saveOutcome فقط ردیف‌های دارای selectedOfferItemId رو از Prisma می‌خواد و روی همون فیلترشده کار می‌کنه", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, [ITEM_1]);
    const { service } = buildService(prisma);

    await service.saveOutcome(INQUIRY_ID, { mode: "won_all", decisionDate: "2026-07-10" }, "user-1");

    expect(prisma.inquiry.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          items: expect.objectContaining({
            where: { selectedOfferItemId: { not: null } },
          }),
        }),
      }),
    );
    // فقط همون یک قلمی که "انتخاب‌شده" فرض شده (mockInquiryWithItems) ثبت می‌شه
    expect(prisma.inquiryItemOutcome.upsert).toHaveBeenCalledTimes(1);
  });

  it("فاز ۴۶: وقتی هیچ ردیفی selectedOfferItemId نداره، پیام خطای مخصوص برمی‌گرده (نه پیام عمومی «هیچ قلمی نداره»)", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, []); // شبیه‌سازی: همه‌ی ردیف‌ها توسط where فیلتر شدن
    const { service } = buildService(prisma);

    await expect(
      service.saveOutcome(INQUIRY_ID, { mode: "won_all", decisionDate: "2026-07-10" }, "user-1"),
    ).rejects.toThrow("هیچ قلمی به مرحله انتخاب نهایی نرسیده — امکان ثبت نتیجه نیست");
  });

  it("a second save overwrites the previous outcome (upsert, not create-only)", async () => {
    const prisma = buildPrisma();
    mockInquiryWithItems(prisma, [ITEM_1]);
    const { service } = buildService(prisma);

    await service.saveOutcome(INQUIRY_ID, { mode: "lost_all", decisionDate: "2026-07-10", lossReason: "delivery_time" }, "user-1");
    await service.saveOutcome(INQUIRY_ID, { mode: "won_all", decisionDate: "2026-07-11" }, "user-1");

    expect(prisma.inquiryItemOutcome.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ result: "won", lossReason: null }),
      }),
    );
  });
});
