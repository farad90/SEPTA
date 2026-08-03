import { Injectable } from "@nestjs/common";
import { format as formatJalaliDate, newDate as newJalaliDate } from "date-fns-jalali";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { ConversionQueryDto, OrdersPnlQueryDto, PaymentsQueryDto } from "./dto/reports.dto";

const UNCURRENCY_KEY = "نامشخص";
const DEFAULT_PAGE_SIZE = 50;

const RFQ_STATUSES = ["awaiting_response", "no_response", "technical_question", "offer_received"] as const;

interface RfqResponseCounts {
  total: number;
  offerReceived: number;
  noResponse: number;
  technicalQuestion: number;
  awaitingResponse: number;
  /** offerReceived ÷ (offerReceived + noResponse) — فقط RFQ های به‌سرانجام‌رسیده در مخرج، مثل conversionRate */
  responseRate: number | null;
}

interface ConversionCounts {
  total: number;
  won: number;
  lost: number;
  partiallyWon: number;
  cancelled: number;
  suspended: number;
  inProgress: number;
  conversionRate: number | null;
}

/**
 * گزارش‌ها و تحلیل‌ها — هیچ جدول جدیدی نداره، فقط روی داده‌ی موجود Query می‌زنه.
 * طبق تصمیم کاربر: مبالغ هیچ‌وقت بین ارزهای مختلف جمع نمی‌شن — همیشه به تفکیک
 * currency_code گزارش می‌شن (چون در کل پروژه زیرساخت تبدیل نرخ ارز خودکار وجود نداره).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------
  // گزارش ۱: سفارشات و سود و زیان
  // ------------------------------------------------------------

  async getOrdersPnl(query: OrdersPnlQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.OrderWhereInput = {};
    if (query.dateFrom || query.dateTo) {
      where.contractDate = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      };
    }
    if (query.buyerId || query.salesExpertId) {
      where.inquiry = {
        ...(query.buyerId && { buyerId: query.buyerId }),
        ...(query.salesExpertId && { salesExpertId: query.salesExpertId }),
      };
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          inquiry: {
            select: {
              id: true,
              internalNumber: true,
              buyer: { select: { companyName: true } },
              salesExpert: { select: { fullName: true } },
            },
          },
          items: { select: { purchasePrice: true, salePrice: true, quantity: true } },
        },
        orderBy: { contractDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const inquiryIds = [...new Set(orders.map((o) => o.inquiryId))];
    const currencyByInquiry = await this.resolveCurrencyByInquiry(inquiryIds);

    const items = orders.map((o) => {
      const totalPurchase = o.items.reduce(
        (sum, i) => sum + Number(i.purchasePrice) * Number(i.quantity),
        0,
      );
      const totalSale = o.items.reduce((sum, i) => sum + Number(i.salePrice) * Number(i.quantity), 0);
      const margin = totalSale - totalPurchase;
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        inquiryInternalNumber: o.inquiry.internalNumber,
        buyerName: o.inquiry.buyer.companyName,
        salesExpertName: o.inquiry.salesExpert.fullName,
        contractDate: o.contractDate,
        currencyCode: currencyByInquiry.get(o.inquiryId) ?? null,
        totalPurchase,
        totalSale,
        margin,
        marginPercent: totalPurchase > 0 ? (margin / totalPurchase) * 100 : null,
      };
    });

    const totalsByCurrency: Record<
      string,
      { totalPurchase: number; totalSale: number; margin: number }
    > = {};
    for (const it of items) {
      const key = it.currencyCode ?? UNCURRENCY_KEY;
      const bucket = (totalsByCurrency[key] ??= { totalPurchase: 0, totalSale: 0, margin: 0 });
      bucket.totalPurchase += it.totalPurchase;
      bucket.totalSale += it.totalSale;
      bucket.margin += it.margin;
    }

    return { items, totalsByCurrency, total, page, pageSize };
  }

  // ------------------------------------------------------------
  // گزارش ۲: پرداختی‌ها و دریافتی‌ها
  // ⚠️ منبع «دریافتی» فقط CustomerPayment است، نه InvoiceCollection —
  // این دو جدول به‌صورت خودکار Sync نمی‌شن (تصمیم طراحی صریح)
  // ------------------------------------------------------------

  async getPayments(query: PaymentsQueryDto) {
    const type = query.type ?? "all";
    const overdueOnly = query.overdueOnly === "true";
    const now = new Date();
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const dueDateFilter =
      dateFrom || dateTo
        ? { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) }
        : undefined;

    const receivableWhere: Prisma.CustomerPaymentWhereInput = {};
    if (dueDateFilter) receivableWhere.dueDate = dueDateFilter;
    if (query.status && ["unpaid", "paid"].includes(query.status)) {
      receivableWhere.status = query.status;
    }

    const payableWhere: Prisma.SupplierPaymentWhereInput = {};
    if (dueDateFilter) payableWhere.dueDate = dueDateFilter;
    if (query.status && ["unpaid", "in_progress", "completed"].includes(query.status)) {
      payableWhere.status = query.status;
    }

    const [customerPayments, supplierPayments] = await Promise.all([
      type === "payable"
        ? []
        : this.prisma.customerPayment.findMany({
            where: receivableWhere,
            include: {
              order: {
                select: {
                  orderNumber: true,
                  inquiryId: true,
                  inquiry: { select: { buyer: { select: { companyName: true } } } },
                },
              },
            },
          }),
      type === "receivable"
        ? []
        : this.prisma.supplierPayment.findMany({
            where: payableWhere,
            include: {
              po: {
                select: {
                  poNumber: true,
                  currencyCode: true,
                  supplier: { select: { companyName: true } },
                },
              },
            },
          }),
    ]);

    const inquiryIds = [...new Set(customerPayments.map((p) => p.order.inquiryId))];
    const currencyByInquiry = await this.resolveCurrencyByInquiry(inquiryIds);

    interface Row {
      id: string;
      type: "receivable" | "payable";
      counterpartyName: string;
      referenceNumber: string;
      dueDate: Date | null;
      amount: number;
      currencyCode: string | null;
      status: string;
      actualDate: Date | null;
      isOverdue: boolean;
    }

    const receivableRows: Row[] = customerPayments.map((p) => ({
      id: p.id,
      type: "receivable",
      counterpartyName: p.order.inquiry.buyer.companyName,
      referenceNumber: p.order.orderNumber,
      dueDate: p.dueDate,
      amount: Number(p.amount),
      currencyCode: currencyByInquiry.get(p.order.inquiryId) ?? null,
      status: p.status,
      actualDate: p.actualPaymentDate,
      isOverdue: !!p.dueDate && p.dueDate < now && p.status !== "paid",
    }));

    const payableRows: Row[] = supplierPayments.map((p) => ({
      id: p.id,
      type: "payable",
      counterpartyName: p.po.supplier.companyName,
      referenceNumber: p.po.poNumber,
      dueDate: p.dueDate,
      amount: Number(p.amount),
      currencyCode: p.po.currencyCode,
      status: p.status,
      actualDate: p.actualPaymentDate,
      isOverdue: !!p.dueDate && p.dueDate < now && p.status !== "completed",
    }));

    let rows = [...receivableRows, ...payableRows];
    if (overdueOnly) rows = rows.filter((r) => r.isOverdue);
    rows.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const total = rows.length;
    const items = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    const totalsByCurrency: Record<
      string,
      { receivableUnpaid: number; receivablePaid: number; payableUnpaid: number; payablePaid: number }
    > = {};
    for (const r of rows) {
      const key = r.currencyCode ?? UNCURRENCY_KEY;
      const bucket = (totalsByCurrency[key] ??= {
        receivableUnpaid: 0,
        receivablePaid: 0,
        payableUnpaid: 0,
        payablePaid: 0,
      });
      if (r.type === "receivable") {
        if (r.status === "paid") bucket.receivablePaid += r.amount;
        else bucket.receivableUnpaid += r.amount;
      } else {
        if (r.status === "completed") bucket.payablePaid += r.amount;
        else bucket.payableUnpaid += r.amount;
      }
    }

    return { items, totalsByCurrency, total, page, pageSize };
  }

  // ------------------------------------------------------------
  // گزارش ۳: تبدیل استعلام به سفارش
  // conversionRate = (won + partiallyWon) / (won + lost + partiallyWon) * 100
  // — فقط پرونده‌های بسته‌شده مبنای نرخ‌ان؛ in_progress/cancelled/suspended در مخرج نیستن
  // ------------------------------------------------------------

  async getConversion(query: ConversionQueryDto) {
    const where: Prisma.InquiryWhereInput = { deletedAt: null };
    if (query.dateFrom || query.dateTo) {
      where.inquiryStartDate = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      };
    }
    if (query.salesExpertId) where.salesExpertId = query.salesExpertId;
    if (query.buyerId) where.buyerId = query.buyerId;

    const inquiries = await this.prisma.inquiry.findMany({
      where,
      select: {
        status: true,
        salesExpertId: true,
        salesExpert: { select: { fullName: true } },
      },
    });

    const overall = this.tallyConversion(inquiries);

    const bySalesExpertMap = new Map<
      string,
      { salesExpertName: string; rows: { status: string }[] }
    >();
    for (const inq of inquiries) {
      const bucket = bySalesExpertMap.get(inq.salesExpertId) ?? {
        salesExpertName: inq.salesExpert.fullName,
        rows: [],
      };
      bucket.rows.push({ status: inq.status });
      bySalesExpertMap.set(inq.salesExpertId, bucket);
    }

    const bySalesExpert = [...bySalesExpertMap.entries()]
      .map(([salesExpertId, g]) => ({
        salesExpertId,
        salesExpertName: g.salesExpertName,
        ...this.tallyConversion(g.rows),
      }))
      .sort((a, b) => b.total - a.total);

    return { overall, bySalesExpert };
  }

  private tallyConversion(rows: { status: string }[]): ConversionCounts {
    const counts = {
      total: rows.length,
      won: 0,
      lost: 0,
      partiallyWon: 0,
      cancelled: 0,
      suspended: 0,
      inProgress: 0,
    };
    for (const r of rows) {
      if (r.status === "won") counts.won += 1;
      else if (r.status === "lost") counts.lost += 1;
      else if (r.status === "partially_won") counts.partiallyWon += 1;
      else if (r.status === "cancelled") counts.cancelled += 1;
      else if (r.status === "suspended") counts.suspended += 1;
      else counts.inProgress += 1;
    }
    const closedTotal = counts.won + counts.lost + counts.partiallyWon;
    const conversionRate = closedTotal > 0 ? ((counts.won + counts.partiallyWon) / closedTotal) * 100 : null;
    return { ...counts, conversionRate };
  }

  // ------------------------------------------------------------
  // گزارش ۴: مبلغ سفارشات خودِ کاربر از ابتدای سال شمسی جاری — فقط فروش، بدون خرید/سود
  // ⚠️ endpoint مستقل از getOrdersPnl — قیمت خرید هرگز در این پاسخ حتی برای سفارش‌های خودِ
  // کاربر هم برنمی‌گرده (محرمانگی قیمت خرید از فروش، هم‌الگوی فاز ۳۵-ب)
  // ------------------------------------------------------------

  async getOwnSalesSummary(salesExpertId: string) {
    const currentJalaliYear = Number(formatJalaliDate(new Date(), "yyyy"));
    const yearStart = newJalaliDate(currentJalaliYear, 0, 1);

    const orders = await this.prisma.order.findMany({
      where: {
        inquiry: { salesExpertId },
        contractDate: { gte: yearStart },
      },
      select: {
        inquiryId: true,
        items: { select: { salePrice: true, quantity: true } },
      },
    });

    const inquiryIds = [...new Set(orders.map((o) => o.inquiryId))];
    const currencyByInquiry = await this.resolveCurrencyByInquiry(inquiryIds);

    const totalsByCurrency: Record<string, number> = {};
    for (const o of orders) {
      const totalSale = o.items.reduce((sum, i) => sum + Number(i.salePrice) * Number(i.quantity), 0);
      const key = currencyByInquiry.get(o.inquiryId) ?? UNCURRENCY_KEY;
      totalsByCurrency[key] = (totalsByCurrency[key] ?? 0) + totalSale;
    }

    return { jalaliYear: currentJalaliYear, orderCount: orders.length, totalsByCurrency };
  }

  // ------------------------------------------------------------
  // گزارش ۵: نرخ پاسخ‌دهی تأمین‌کنندگان به استعلام قیمت (RFQ) — سراسری، برای بازرگانی/مدیریت
  // ------------------------------------------------------------

  async getRfqResponseRate() {
    const grouped = await this.prisma.supplierRfq.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const counts: Record<(typeof RFQ_STATUSES)[number], number> = {
      awaiting_response: 0,
      no_response: 0,
      technical_question: 0,
      offer_received: 0,
    };
    for (const g of grouped) {
      if ((RFQ_STATUSES as readonly string[]).includes(g.status)) {
        counts[g.status as (typeof RFQ_STATUSES)[number]] = g._count._all;
      }
    }

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const resolvedTotal = counts.offer_received + counts.no_response;
    const responseRate: RfqResponseCounts["responseRate"] =
      resolvedTotal > 0 ? (counts.offer_received / resolvedTotal) * 100 : null;

    return {
      total,
      offerReceived: counts.offer_received,
      noResponse: counts.no_response,
      technicalQuestion: counts.technical_question,
      awaitingResponse: counts.awaiting_response,
      responseRate,
    } satisfies RfqResponseCounts;
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  /** ارز هر استعلام از پیشنهاد مالی جاری‌اش (همون الگوی settlement.service.ts) — دسته‌جمعی تا N+1 نشه */
  private async resolveCurrencyByInquiry(inquiryIds: string[]): Promise<Map<string, string>> {
    if (inquiryIds.length === 0) return new Map();
    const financials = await this.prisma.financialProposal.findMany({
      where: { inquiryId: { in: inquiryIds }, status: "current" },
      select: { inquiryId: true, currencyCode: true },
    });
    return new Map(financials.map((f) => [f.inquiryId, f.currencyCode]));
  }
}
