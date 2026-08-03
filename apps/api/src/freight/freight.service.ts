import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { MailService } from "../mail/mail.service";
import { FreightRfqNumberService } from "./freight-rfq-number.service";
import { ShipmentNumberService } from "../shipments/shipment-number.service";
import {
  buildFreightRfqEmailHtml,
  buildFreightRfqEmailText,
  FreightRfqEmailInput,
} from "./freight-rfq-email.builder";
import { CreateFreightRfqDto, SaveFreightOfferDto } from "./dto/freight.dto";

const RFQ_INCLUDE = {
  freightCompany: { select: { id: true, companyName: true, country: true, email: true } },
  commercialExpert: { select: { id: true, fullName: true, email: true } },
  packages: {
    include: {
      package: {
        select: {
          id: true,
          packageNumber: true,
          lengthCm: true,
          widthCm: true,
          heightCm: true,
          weightKg: true,
          pickupLocation: true,
          po: { select: { poNumber: true } },
        },
      },
    },
  },
  offers: { include: { currency: true }, orderBy: { receivedAt: "desc" as const } },
} satisfies import("../../generated/prisma").Prisma.FreightRfqInclude;

/**
 * فاز ۱۱ — ماژول سراسری «مدیریت بارها»، بخش استعلام حمل. الگوی خیلی نزدیک به
 * RfqsService (فاز ۴): شماره‌گذاری اتمیک، ارسال ایمیل واقعی با SMTP Fallback،
 * یک پیشنهاد به‌ازای هر RFQ (بازنویسی، نه چندتایی). «بسته آماده» یک Query
 * واقعاً Cross-Inquiry است — اولین‌بار در پروژه.
 */
@Injectable()
export class FreightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: FreightRfqNumberService,
    private readonly shipmentNumberService: ShipmentNumberService,
    private readonly activityLog: ActivityLogService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------
  // بسته‌های آماده برای استعلام حمل — Cross-Inquiry
  // ------------------------------------------------------------

  async listReadyPackages() {
    const packages = await this.prisma.package.findMany({
      where: {
        status: "ready_to_ship",
        shipmentPackages: { none: {} },
      },
      include: {
        po: {
          select: {
            poNumber: true,
            supplier: { select: { companyName: true } },
            order: {
              select: {
                inquiry: { select: { id: true, internalNumber: true, subject: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return packages.map((pkg) => ({
      id: pkg.id,
      packageNumber: pkg.packageNumber,
      lengthCm: pkg.lengthCm != null ? Number(pkg.lengthCm) : null,
      widthCm: pkg.widthCm != null ? Number(pkg.widthCm) : null,
      heightCm: pkg.heightCm != null ? Number(pkg.heightCm) : null,
      weightKg: Number(pkg.weightKg),
      pickupLocation: pkg.pickupLocation,
      poNumber: pkg.po.poNumber,
      supplierName: pkg.po.supplier.companyName,
      inquiryId: pkg.po.order.inquiry.id,
      inquiryNumber: pkg.po.order.inquiry.internalNumber,
      inquirySubject: pkg.po.order.inquiry.subject,
    }));
  }

  // ------------------------------------------------------------
  // FreightRfq
  // ------------------------------------------------------------

  async listRfqs() {
    const rfqs = await this.prisma.freightRfq.findMany({
      include: RFQ_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    const shipmentByOffer = new Map(
      (
        await this.prisma.shipment.findMany({
          where: { selectedFreightOfferId: { not: null } },
          select: { id: true, shipmentNumber: true, selectedFreightOfferId: true },
        })
      ).map((s) => [s.selectedFreightOfferId as string, s]),
    );
    return rfqs.map((rfq) => ({
      ...this.formatRfq(rfq),
      wonShipment: rfq.offers[0] ? (shipmentByOffer.get(rfq.offers[0].id) ?? null) : null,
    }));
  }

  async create(dto: CreateFreightRfqDto, currentUserId: string) {
    const freightCompany = await this.prisma.businessPartner.findUnique({
      where: { id: dto.freightCompanyId },
      select: { partnerType: true, companyName: true },
    });
    if (!freightCompany) {
      throw new NotFoundException("شرکت حمل یافت نشد");
    }
    if (freightCompany.partnerType !== "freight_forwarder") {
      throw new BadRequestException("طرف انتخاب‌شده باید از نوع «شرکت حمل» باشه");
    }

    const uniquePackageIds = [...new Set(dto.packageIds)];
    const packages = await this.prisma.package.findMany({
      where: { id: { in: uniquePackageIds } },
      include: { shipmentPackages: true },
    });
    if (packages.length !== uniquePackageIds.length) {
      throw new BadRequestException("بعضی بسته‌های انتخاب‌شده یافت نشدن");
    }
    const notReady = packages.filter((p) => p.status !== "ready_to_ship");
    if (notReady.length > 0) {
      throw new BadRequestException("همه بسته‌ها باید «آماده حمل» باشن");
    }
    const alreadyShipped = packages.filter((p) => p.shipmentPackages.length > 0);
    if (alreadyShipped.length > 0) {
      throw new BadRequestException("بعضی بسته‌ها قبلاً به یک محموله دیگه اختصاص یافتن");
    }

    const rfq = await this.prisma.$transaction(async (tx) => {
      const rfqNumber = await this.numberService.nextNumber(tx);
      return tx.freightRfq.create({
        data: {
          rfqNumber,
          freightCompanyId: dto.freightCompanyId,
          commercialExpertId: currentUserId,
          destinationCustoms: dto.destinationCustoms,
          emailSubject: dto.emailSubject?.trim() || rfqNumber,
          sentDate: new Date(),
          packages: { create: uniquePackageIds.map((packageId) => ({ packageId })) },
        },
        include: RFQ_INCLUDE,
      });
    });

    let emailSent = false;
    let emailError: string | null = null;
    try {
      emailSent = await this.mail.send({
        to: dto.recipientEmail,
        subject: rfq.emailSubject ?? rfq.rfqNumber,
        html: buildFreightRfqEmailHtml(this.toEmailInput(rfq)),
        replyTo: rfq.commercialExpert.email ?? undefined,
        cc: rfq.commercialExpert.email ?? undefined,
      });
    } catch (error) {
      emailError = (error as Error).message;
    }

    await this.logToInvolvedInquiries(
      uniquePackageIds,
      currentUserId,
      `استعلام حمل ${rfq.rfqNumber} با ${uniquePackageIds.length} بسته به «${freightCompany.companyName}» ارسال شد`,
      "stage_completed",
      { module: "freight_rfq", rfqNumber: rfq.rfqNumber, emailSent },
    );

    return { ...this.formatRfq(rfq), emailSent, emailError };
  }

  async getById(id: string) {
    const rfq = await this.prisma.freightRfq.findUnique({ where: { id }, include: RFQ_INCLUDE });
    if (!rfq) {
      throw new NotFoundException("استعلام حمل یافت نشد");
    }
    return rfq;
  }

  async emailPreview(id: string) {
    const rfq = await this.getById(id);
    const input = this.toEmailInput(rfq);
    return {
      subject: rfq.emailSubject ?? rfq.rfqNumber,
      html: buildFreightRfqEmailHtml(input),
      text: buildFreightRfqEmailText(input),
      smtpConfigured: this.mail.isConfigured(),
    };
  }

  async resendEmail(id: string, recipientEmail: string) {
    const rfq = await this.getById(id);
    if (!this.mail.isConfigured()) {
      throw new BadRequestException("SMTP پیکربندی نشده — از پیش‌نمایش، متن رو کپی و دستی ارسال کن");
    }
    await this.mail.send({
      to: recipientEmail,
      subject: rfq.emailSubject ?? rfq.rfqNumber,
      html: buildFreightRfqEmailHtml(this.toEmailInput(rfq)),
      replyTo: rfq.commercialExpert.email ?? undefined,
      cc: rfq.commercialExpert.email ?? undefined,
    });
    return { success: true };
  }

  // ------------------------------------------------------------
  // پیشنهاد قیمت — یک پیشنهاد به‌ازای هر RFQ (بازنویسی، نه چندتایی)
  // ------------------------------------------------------------

  async saveOffer(rfqId: string, dto: SaveFreightOfferDto) {
    const rfq = await this.getById(rfqId);
    const currency = await this.prisma.currency.findUnique({ where: { currencyCode: dto.currencyCode } });
    if (!currency) {
      throw new BadRequestException("ارز نامعتبره");
    }

    const existing = rfq.offers[0];
    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.freightOffer.update({
          where: { id: existing.id },
          data: {
            price: dto.price,
            currencyCode: dto.currencyCode,
            transitTimeDays: dto.transitTimeDays,
            offerDate: dto.offerDate ? new Date(dto.offerDate) : null,
            validityDate: dto.validityDate ? new Date(dto.validityDate) : null,
            notes: dto.notes,
          },
        });
      } else {
        await tx.freightOffer.create({
          data: {
            freightRfqId: rfqId,
            price: dto.price,
            currencyCode: dto.currencyCode,
            transitTimeDays: dto.transitTimeDays,
            offerDate: dto.offerDate ? new Date(dto.offerDate) : undefined,
            validityDate: dto.validityDate ? new Date(dto.validityDate) : undefined,
            notes: dto.notes,
          },
        });
      }
      await tx.freightRfq.update({
        where: { id: rfqId },
        data: { status: "offer_received", updatedAt: new Date() },
      });
    });

    return this.formatRfq(await this.getById(rfqId));
  }

  // ------------------------------------------------------------
  // انتخاب برنده → ساخت محموله
  // ------------------------------------------------------------

  async selectWinner(rfqId: string, currentUserId: string) {
    const rfq = await this.getById(rfqId);
    const offer = rfq.offers[0];
    if (!offer) {
      throw new BadRequestException("این استعلام حمل هنوز پیشنهاد قیمتی نداره");
    }

    const packageIds = rfq.packages.map((p) => p.packageId);
    const alreadyShipped = await this.prisma.shipmentPackage.findMany({
      where: { packageId: { in: packageIds } },
    });
    if (alreadyShipped.length > 0) {
      throw new BadRequestException(
        "بعضی بسته‌های این استعلام قبلاً از طریق یک استعلام دیگه به یک محموله اختصاص یافتن",
      );
    }

    const shipment = await this.prisma.$transaction(async (tx) => {
      const shipmentNumber = await this.shipmentNumberService.nextNumber(tx);
      return tx.shipment.create({
        data: {
          shipmentNumber,
          commercialExpertId: currentUserId,
          freightCompanyId: rfq.freightCompanyId,
          selectedFreightOfferId: offer.id,
          destinationCustoms: rfq.destinationCustoms,
          stage: "consolidating",
          consolidationStartDate: new Date(),
          packages: { create: packageIds.map((packageId) => ({ packageId })) },
        },
      });
    });

    await this.logToInvolvedInquiries(
      packageIds,
      currentUserId,
      `شرکت حمل «${rfq.freightCompany.companyName}» برای ${rfq.rfqNumber} به‌عنوان برنده انتخاب شد — محموله ${shipment.shipmentNumber} ساخته شد`,
      "stage_completed",
      { module: "freight_rfq", action: "winner_selected", shipmentId: shipment.id },
    );

    return shipment;
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  /** فان‌اوت لاگ فعالیت به همهٔ پرونده‌های مرتبط با این بسته‌ها (design doc: Cross-Cutting Concern) */
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

  private toEmailInput(rfq: Awaited<ReturnType<FreightService["getById"]>>): FreightRfqEmailInput {
    return {
      rfqNumber: rfq.rfqNumber,
      subject: rfq.emailSubject ?? rfq.rfqNumber,
      expertFullName: rfq.commercialExpert.fullName,
      destinationCustoms: rfq.destinationCustoms,
      packages: rfq.packages.map((p) => ({
        packageNumber: p.package.packageNumber,
        lengthCm: p.package.lengthCm != null ? Number(p.package.lengthCm) : null,
        widthCm: p.package.widthCm != null ? Number(p.package.widthCm) : null,
        heightCm: p.package.heightCm != null ? Number(p.package.heightCm) : null,
        weightKg: Number(p.package.weightKg),
        pickupLocation: p.package.pickupLocation,
        poNumber: p.package.po.poNumber,
      })),
    };
  }

  private formatRfq(rfq: Awaited<ReturnType<FreightService["getById"]>>) {
    return {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      destinationCustoms: rfq.destinationCustoms,
      emailSubject: rfq.emailSubject,
      sentDate: rfq.sentDate,
      status: rfq.status,
      freightCompany: rfq.freightCompany,
      commercialExpert: rfq.commercialExpert,
      packages: rfq.packages.map((p) => ({
        id: p.package.id,
        packageNumber: p.package.packageNumber,
        weightKg: Number(p.package.weightKg),
        poNumber: p.package.po.poNumber,
      })),
      offer: rfq.offers[0]
        ? {
            id: rfq.offers[0].id,
            price: Number(rfq.offers[0].price),
            currencyCode: rfq.offers[0].currencyCode,
            transitTimeDays: rfq.offers[0].transitTimeDays,
            offerDate: rfq.offers[0].offerDate,
            receivedAt: rfq.offers[0].receivedAt,
            validityDate: rfq.offers[0].validityDate,
            notes: rfq.offers[0].notes,
          }
        : null,
    };
  }
}
