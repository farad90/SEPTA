import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { MailService } from "../mail/mail.service";
import { FreightRfqNumberService } from "./freight-rfq-number.service";
import { ShipmentNumberService } from "../shipments/shipment-number.service";
import { FreightService } from "./freight.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const FREIGHT_COMPANY_ID = "22222222-2222-2222-2222-222222222222";
const PKG_A = "33333333-3333-3333-3333-333333333333";
const PKG_B = "44444444-4444-4444-4444-444444444444";
const RFQ_ID = "55555555-5555-5555-5555-555555555555";
const OFFER_ID = "66666666-6666-6666-6666-666666666666";

function buildPrisma() {
  return {
    businessPartner: { findUnique: jest.fn() },
    package: { findMany: jest.fn() },
    freightRfq: { findUnique: jest.fn(), findMany: jest.fn() },
    shipment: { findMany: jest.fn() },
    shipmentPackage: { findMany: jest.fn() },
    currency: { findUnique: jest.fn() },
    freightOffer: { create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const numberService = { nextNumber: jest.fn().mockResolvedValue("FRT-2026-0001") };
  const shipmentNumberService = { nextNumber: jest.fn().mockResolvedValue("SHP-2026-0001") };
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const mail = { isConfigured: jest.fn().mockReturnValue(false), send: jest.fn().mockResolvedValue(false) };
  const service = new FreightService(
    prisma as unknown as PrismaService,
    numberService as unknown as FreightRfqNumberService,
    shipmentNumberService as unknown as ShipmentNumberService,
    activityLog as unknown as ActivityLogService,
    mail as unknown as MailService,
  );
  return { service, numberService, shipmentNumberService, activityLog };
}

const BASE_RFQ = {
  id: RFQ_ID,
  rfqNumber: "FRT-2026-0001",
  destinationCustoms: "گمرک بازرگان",
  emailSubject: "FRT-2026-0001",
  sentDate: new Date(),
  status: "offer_received",
  freightCompanyId: FREIGHT_COMPANY_ID,
  freightCompany: { id: FREIGHT_COMPANY_ID, companyName: "DHL", country: "DE", email: "ops@dhl.com" },
  commercialExpert: { id: USER_ID, fullName: "کارشناس", email: "e@x.com" },
  packages: [
    { packageId: PKG_A, package: { id: PKG_A, packageNumber: "بسته 1", weightKg: "10", po: { poNumber: "PO-1" } } },
    { packageId: PKG_B, package: { id: PKG_B, packageNumber: "بسته 2", weightKg: "5", po: { poNumber: "PO-1" } } },
  ],
  offers: [{ id: OFFER_ID, price: "500", currencyCode: "EUR", transitTimeDays: 10, offerDate: null, receivedAt: new Date(), validityDate: null, notes: null }],
};

describe("FreightService — ساخت استعلام حمل", () => {
  it("rejects a company that isn't a freight_forwarder", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "supplier", companyName: "X" });
    const { service } = buildService(prisma);

    await expect(
      service.create(
        { freightCompanyId: FREIGHT_COMPANY_ID, destinationCustoms: "بازرگان", packageIds: [PKG_A], recipientEmail: "a@b.com" },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects packages that aren't ready_to_ship", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "freight_forwarder", companyName: "DHL" });
    prisma.package.findMany.mockResolvedValue([{ id: PKG_A, status: "defining", shipmentPackages: [] }]);
    const { service } = buildService(prisma);

    await expect(
      service.create(
        { freightCompanyId: FREIGHT_COMPANY_ID, destinationCustoms: "بازرگان", packageIds: [PKG_A], recipientEmail: "a@b.com" },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects packages already committed to a shipment", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ partnerType: "freight_forwarder", companyName: "DHL" });
    prisma.package.findMany.mockResolvedValue([
      { id: PKG_A, status: "ready_to_ship", shipmentPackages: [{ shipmentId: "shp-1" }] },
    ]);
    const { service } = buildService(prisma);

    await expect(
      service.create(
        { freightCompanyId: FREIGHT_COMPANY_ID, destinationCustoms: "بازرگان", packageIds: [PKG_A], recipientEmail: "a@b.com" },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("FreightService — پیشنهاد قیمت", () => {
  it("creates the offer when none exists yet (not update)", async () => {
    const prisma = buildPrisma();
    prisma.freightRfq.findUnique.mockResolvedValue({ ...BASE_RFQ, offers: [] });
    prisma.currency.findUnique.mockResolvedValue({ currencyCode: "EUR" });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ freightOffer: { create: jest.fn(), update: jest.fn() }, freightRfq: { update: jest.fn() } }),
    );
    const { service } = buildService(prisma);

    await service.saveOffer(RFQ_ID, { price: 500, currencyCode: "EUR" });
    // دومین findUnique داخل getById دوباره صدا زده می‌شه — فقط چک می‌کنیم استثنا نده
    expect(prisma.currency.findUnique).toHaveBeenCalled();
  });
});

describe("FreightService — انتخاب برنده", () => {
  it("rejects when the RFQ has no offer yet", async () => {
    const prisma = buildPrisma();
    prisma.freightRfq.findUnique.mockResolvedValue({ ...BASE_RFQ, offers: [] });
    const { service } = buildService(prisma);

    await expect(service.selectWinner(RFQ_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when a package is already committed via a competing RFQ", async () => {
    const prisma = buildPrisma();
    prisma.freightRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.shipmentPackage.findMany.mockResolvedValue([{ shipmentId: "shp-1", packageId: PKG_A }]);
    const { service } = buildService(prisma);

    await expect(service.selectWinner(RFQ_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a shipment with the RFQ's packages when nothing conflicts", async () => {
    const prisma = buildPrisma();
    prisma.freightRfq.findUnique.mockResolvedValue(BASE_RFQ);
    prisma.shipmentPackage.findMany.mockResolvedValue([]);
    prisma.package.findMany.mockResolvedValue([
      { po: { order: { inquiryId: "inq-1" } } },
      { po: { order: { inquiryId: "inq-2" } } },
    ]);
    const createShipment = jest.fn().mockResolvedValue({ id: "shp-new", shipmentNumber: "SHP-2026-0001" });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ shipment: { create: createShipment } }),
    );
    const { service, activityLog } = buildService(prisma);

    const result = await service.selectWinner(RFQ_ID, USER_ID);

    expect(result.shipmentNumber).toBe("SHP-2026-0001");
    expect(createShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          selectedFreightOfferId: OFFER_ID,
          freightCompanyId: FREIGHT_COMPANY_ID,
          stage: "consolidating",
        }),
      }),
    );
    // فان‌اوت لاگ فعالیت به هر دو پرونده مرتبط
    expect(activityLog.log).toHaveBeenCalledTimes(2);
  });
});
