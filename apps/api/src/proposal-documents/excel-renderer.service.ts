import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { format as formatJalaliDate } from "date-fns-jalali";
import { ProposalDocumentData } from "./proposal-document-data.type";
import { ProposalDocLang } from "./html-template.builder";
import { formatMoney, translateUnit } from "./format-helpers";

const LABELS = {
  fa: {
    financialTitle: "پیش‌فاکتور",
    technicalTitle: "پیشنهاد فنی",
    seller: "فروشنده",
    buyer: "خریدار",
    destination: "مقصد",
    idNo: "شناسه/کد اقتصادی",
    proposalNumber: "شماره پیش‌فاکتور",
    technicalNumber: "شماره پیشنهاد فنی",
    proposalDate: "تاریخ پیش‌فاکتور",
    validUntil: "اعتبار پیشنهاد تا",
    salesExpert: "کارشناس استعلام",
    buyerContact: "کارشناس",
    inquiryNumber: "مرجع مشتری",
    customerNo: "شماره مشتری",
    row: "ردیف",
    partNumber: "پارت نامبر",
    itemDescription: "شرح کالا",
    builder: "برند/سازنده",
    countryOfOrigin: "CO",
    quantity: "مقدار",
    unit: "واحد",
    unitPrice: "قیمت واحد",
    totalPrice: "قیمت کل",
    days: "روز",
    sumTotal: "جمع اقلام",
    otherCostsSummary: "سایر هزینه‌ها",
    totalAmount: "جمع کل",
    deliveryTerm: "ترم تحویل (INCOTERMS 2000)",
    shippingMethod: "روش حمل",
    currency: "واحد پول",
    paymentTerms: "شرایط پرداخت",
    paymentMethod: "روش پرداخت",
    partialShipmentAllowed: "ارسال جزئی",
    allowed: "مجاز",
    notAllowed: "غیرمجاز",
    documentsChecklist: "مدارک ارسالی همراه محموله",
    legalEffect: "اعتبار قانونی",
    otherServices: "سایر خدمات",
    serviceTest: "تست",
    serviceFieldService: "خدمات نصب/راه‌اندازی",
    serviceDesign: "طراحی",
    warranty: "گارانتی",
    remarks: "ملاحظات",
    equivalentTag: "معادل",
    noPriceNote: "قیمت اقلام صرفاً در نسخه پیش‌فاکتور (پیشنهاد مالی) ارائه می‌شود.",
    salesExpertContact: "مشخصات کارشناس فروش",
    extension: "داخلی",
    mobile: "موبایل",
    docInvoiceCopy: "کپی اینویس",
    docPackingList: "پکینگ لیست",
    docManufacturerTestCertificate: "گواهی تست سازنده",
    docCertificateOfOrigin: "گواهی مبدأ",
    docOtherOnRequest: "سایر گواهی‌های قابل ارائه بنا به درخواست",
  },
  en: {
    // فاز ۵۵ — بازخورد کاربر: مالی (قیمت‌دار) = Commercial Offer، فنی (بدون قیمت) = Technical
    // Offer؛ هم‌راستا با kindLabel که در proposal-documents.service.ts از قبل همین قاعده رو داشت
    financialTitle: "Commercial Offer",
    technicalTitle: "Technical Offer",
    seller: "Seller",
    buyer: "Buyer",
    destination: "Destination",
    idNo: "ID No.",
    proposalNumber: "Commercial Offer No.",
    technicalNumber: "Technical Offer No.",
    proposalDate: "Proforma Date",
    validUntil: "Valid Until",
    salesExpert: "Sales Expert",
    buyerContact: "Contact",
    inquiryNumber: "Client Reference",
    customerNo: "Customer No.",
    row: "#",
    partNumber: "Part Number",
    itemDescription: "Description",
    builder: "Brand/Manufacturer",
    countryOfOrigin: "CO",
    quantity: "Qty",
    unit: "Unit",
    unitPrice: "Unit Price",
    totalPrice: "Total Price",
    days: "days",
    sumTotal: "Sum-Total",
    otherCostsSummary: "Other Costs",
    totalAmount: "Total Price",
    deliveryTerm: "Delivery Term (INCOTERMS 2000)",
    shippingMethod: "Shipping Method",
    currency: "Currency",
    paymentTerms: "Payment Terms",
    paymentMethod: "Payment Method",
    partialShipmentAllowed: "Partial Shipment",
    allowed: "Allowed",
    notAllowed: "Not Allowed",
    documentsChecklist: "Documents Accompanying Shipment",
    legalEffect: "Legal Effect",
    otherServices: "Other Services",
    serviceTest: "Test",
    serviceFieldService: "Field Service",
    serviceDesign: "Design",
    warranty: "Warranty",
    remarks: "Remarks",
    equivalentTag: "Equivalent",
    noPriceNote: "Item prices are only included in the Commercial Offer (financial proposal).",
    salesExpertContact: "Sales Expert Contact",
    extension: "Ext.",
    mobile: "Mobile",
    docInvoiceCopy: "Invoice Copy",
    docPackingList: "Packing List",
    docManufacturerTestCertificate: "Manufacturer Test Certificate",
    docCertificateOfOrigin: "Certificate of Origin",
    docOtherOnRequest: "Other certificates available upon request",
  },
} as const;

// ⚠️ فاز ۵۳ — چینش جدول اقلام مطابق قالب مرجع پیوستی: هر قلم یک ردیفِ فشرده (ردیف/پارت‌نامبر/
// مقدار/واحد/CO/[قیمت]) + یک ردیفِ تمام‌عرض برای شرح کالا زیرش داره؛ ستون برند/سازنده مستقل
// حذف شد (مرجع همچین ستونی نداره) و به همون ردیف شرح منتقل شد
// فاز ۵۴ — ستون برند/سازنده مستقل، بلافاصله قبل از CO (بازخورد کاربر: باید کنار CO باشه)
const FINANCIAL_COL_WIDTHS = [6, 16, 9, 9, 12, 9, 13, 13];
const TECHNICAL_COL_WIDTHS = [6, 18, 11, 11, 14, 12];

const DOCUMENT_CHECKLIST_LABEL_KEY = {
  invoice_copy: "docInvoiceCopy",
  packing_list: "docPackingList",
  manufacturer_test_certificate: "docManufacturerTestCertificate",
  certificate_of_origin: "docCertificateOfOrigin",
  other_on_request: "docOtherOnRequest",
} as const;

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E6DC" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFDDDDDD" } },
  left: { style: "thin", color: { argb: "FFDDDDDD" } },
  bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
  right: { style: "thin", color: { argb: "FFDDDDDD" } },
};

function formatDate(date: Date | null, lang: ProposalDocLang): string {
  if (!date) return "—";
  return lang === "fa" ? formatJalaliDate(date, "yyyy/MM/dd") : date.toISOString().slice(0, 10);
}

function bilingual(fa: string | null | undefined, en: string | null | undefined, lang: ProposalDocLang): string {
  if (lang === "en") return en || fa || "—";
  return fa || "—";
}

/**
 * فاز ۵۶ — بازخورد کاربر (باگ واقعی): تا اینجا واحد انتخابی کاربر (روز/هفته) در
 * DeliveryTimeInput هیچ‌جا ذخیره نمی‌شد و سند همیشه به روز نشون می‌داد — دقیقاً
 * هم‌الگوی formatDeliveryDuration در html-template.builder.ts
 */
function formatDeliveryDuration(days: number | null, unit: "day" | "week", lang: ProposalDocLang): string {
  if (days == null) return "";
  if (unit === "week") {
    const weeks = Math.round((days / 7) * 10) / 10;
    const label = lang === "fa" ? "هفته" : weeks === 1 ? "week" : "weeks";
    return `${weeks} ${label}`;
  }
  const label = lang === "fa" ? "روز" : "days";
  return `${days} ${label}`;
}

/** جمله ثابت اعتبار قانونی — بر مبنای تاریخ اعتبار پیشنهاد که از قبل در سند موجوده */
function legalEffectLine(validUntil: string, lang: ProposalDocLang): string {
  return lang === "fa"
    ? `این پیش‌فاکتور تا تاریخ ${validUntil} معتبر است و منوط به تأیید نهایی طرفین است.`
    : `This commercial offer is valid until ${validUntil} and is subject to final confirmation by both parties.`;
}

@Injectable()
export class ExcelRendererService {
  async render(
    data: ProposalDocumentData,
    lang: ProposalDocLang,
    logo: { buffer: Buffer; extension: "png" | "jpeg" | "gif" } | null,
    barcode: Buffer | null,
  ): Promise<Buffer> {
    const t = LABELS[lang];
    const isFinancial = data.kind === "financial";
    const colWidths = isFinancial ? FINANCIAL_COL_WIDTHS : TECHNICAL_COL_WIDTHS;
    const colCount = colWidths.length;
    const align = lang === "fa" ? "right" : "left";

    const sellerName = bilingual(data.ourEntity?.entityName, data.ourEntity?.entityNameEn, lang);
    const sellerAddress = bilingual(data.ourEntity?.address, data.ourEntity?.addressEn, lang);
    const salesExpertName = bilingual(data.salesExpertName, data.salesExpertNameEn, lang);
    const buyerName = bilingual(data.buyer.companyName, data.buyer.companyNameEn, lang);
    const buyerAddress = bilingual(data.buyer.address, data.buyer.addressEn, lang);
    const buyerContactName = data.buyerContact
      ? bilingual(data.buyerContact.contactName, data.buyerContact.contactNameEn, lang)
      : null;
    const buyerIdNo = data.buyer.taxId || data.buyer.registrationNumber || "—";
    const destinationAddress = data.incotermLocation || buyerAddress;
    const destinationTel = data.buyerContact?.mobile || data.buyer.phone || "—";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(isFinancial ? "Proforma" : "Technical Offer", {
      views: [{ rightToLeft: lang === "fa" }],
    });
    sheet.columns = colWidths.map((w) => ({ width: w }));

    let r = 1;
    const mergedTextRow = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => {
      sheet.mergeCells(r, 1, r, colCount);
      const cell = sheet.getCell(r, 1);
      cell.value = text;
      cell.font = { bold: opts.bold, size: opts.size ?? 11, color: { argb: opts.color ?? "FF1A1A1A" } };
      cell.alignment = { horizontal: align, vertical: "middle" };
      r += 1;
      return cell;
    };

    /** یک ردیف خلاصهٔ جمع (Sum-Total/Other Costs/Total Price) — برچسب در A تا ستون قبل‌آخر، مقدار در دو ستون آخر */
    const summaryRow = (label: string, value: string) => {
      sheet.mergeCells(r, 1, r, colCount - 2);
      const labelCell = sheet.getCell(r, 1);
      labelCell.value = label;
      labelCell.font = { bold: true };
      labelCell.fill = TOTAL_FILL;
      labelCell.alignment = { horizontal: align, vertical: "middle" };
      labelCell.border = THIN_BORDER;

      sheet.mergeCells(r, colCount - 1, r, colCount);
      const valueCell = sheet.getCell(r, colCount - 1);
      valueCell.value = value;
      valueCell.font = { bold: true };
      valueCell.fill = TOTAL_FILL;
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = THIN_BORDER;
      r += 1;
    };

    // عنوان سند — وسط‌چین بالای صفحه (فاز ۴۰-د، دست‌نخورده)
    sheet.mergeCells(r, 1, r, colCount);
    const titleCell = sheet.getCell(r, 1);
    titleCell.value = isFinancial ? t.financialTitle : t.technicalTitle;
    titleCell.font = { bold: true, size: 20, color: { argb: "FF1F3A5F" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(r).height = 30;
    r += 1;

    // فضای لوگو (لوگو به‌صورت شناور روی این ردیف‌ها قرار می‌گیره)
    const logoAnchorRow = r;
    sheet.getRow(r).height = 20;
    r += 7;

    if (logo) {
      const imageId = workbook.addImage({ buffer: logo.buffer as never, extension: logo.extension });
      sheet.addImage(imageId, {
        tl: { col: lang === "fa" ? colCount - 2 : 0, row: logoAnchorRow - 1 },
        ext: { width: 340, height: 136 },
      });
    }
    if (barcode) {
      const barcodeImageId = workbook.addImage({ buffer: barcode as never, extension: "png" });
      sheet.addImage(barcodeImageId, {
        tl: { col: lang === "fa" ? 0 : colCount - 3, row: logoAnchorRow - 1 },
        ext: { width: 110, height: 37 },
      });
    }

    mergedTextRow(`${isFinancial ? t.proposalNumber : t.technicalNumber}: ${data.proposalNumber}`, { bold: true });
    mergedTextRow(
      `${t.proposalDate}: ${formatDate(data.preparedDate, lang)}` +
        (isFinancial ? `    ${t.validUntil}: ${formatDate(data.proposalValidityDate, lang)}` : ""),
    );
    mergedTextRow(`${t.salesExpert}: ${salesExpertName}    ${t.inquiryNumber}: ${data.clientReference ?? data.internalNumber}`);
    mergedTextRow(`${t.customerNo}: ${data.buyer.registrationNumber ?? "—"}`);
    r += 1;
    mergedTextRow(`${t.seller}: ${sellerName} — ${sellerAddress} — ${data.ourEntity?.phone ?? "—"} / ${data.ourEntity?.email ?? "—"}`, {
      bold: true,
    });
    mergedTextRow(
      `${t.buyer}: ${buyerName} — ${t.idNo}: ${buyerIdNo} — ${buyerAddress} — ${data.buyer.phone ?? "—"} / ${data.buyer.email ?? "—"}` +
        (buyerContactName ? `    ${t.buyerContact}: ${buyerContactName}` : ""),
      { bold: true },
    );
    mergedTextRow(`${t.destination}: ${buyerName} — ${destinationAddress} — ${destinationTel}`);
    r += 1;

    // سربرگ جدول اقلام — ستون برند/سازنده مستقل، بلافاصله قبل از CO
    const headerLabels: string[] = [t.row, t.partNumber, t.quantity, t.unit, t.builder, t.countryOfOrigin];
    if (isFinancial) headerLabels.push(t.unitPrice, t.totalPrice);
    const headerRow = sheet.getRow(r);
    headerLabels.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = THIN_BORDER;
    });
    r += 1;

    for (const item of data.items) {
      const values: (string | number)[] = [
        item.rowIndex,
        item.partNumber ?? "—",
        item.quantity,
        translateUnit(item.measurementUnit, lang),
        item.builder ?? "—",
        item.countryOfOrigin ?? "—",
      ];
      if (isFinancial) {
        values.push(formatMoney(item.unitPrice, data.currencyCode, lang), formatMoney(item.totalPrice, data.currencyCode, lang));
      }

      const factRow = sheet.getRow(r);
      values.forEach((value, i) => {
        const cell = factRow.getCell(i + 1);
        cell.value = value;
        cell.border = THIN_BORDER;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      r += 1;

      // ردیف تمام‌عرضِ شرح کالا — زیر ردیف فشردهٔ همون قلم (مطابق قالب مرجع)
      const description = item.description + (item.isEquivalent ? ` [${t.equivalentTag}]` : "");
      sheet.mergeCells(r, 1, r, colCount);
      const descCell = sheet.getCell(r, 1);
      descCell.value = description;
      descCell.border = THIN_BORDER;
      descCell.alignment = { horizontal: align, vertical: "top", wrapText: true };
      r += 1;
    }

    if (isFinancial) {
      summaryRow(t.sumTotal, formatMoney(data.totalAmount, data.currencyCode, lang));
      summaryRow(t.otherCostsSummary, "—");
      summaryRow(t.totalAmount, formatMoney(data.totalAmount, data.currencyCode, lang));
    } else {
      mergedTextRow(t.noPriceNote, { color: "FF777777" });
    }
    r += 1;

    mergedTextRow(
      `${t.deliveryTerm}: ${data.chosenDeliveryTerm ?? "—"}${data.incotermLocation ? ` — ${data.incotermLocation}` : ""}${data.deliveryDays != null ? ` (${formatDeliveryDuration(data.deliveryDays, data.deliveryDaysUnit, lang)})` : ""}`,
    );
    if (data.shippingMethod) {
      mergedTextRow(`${t.shippingMethod}: ${data.shippingMethod}`);
    }
    if (isFinancial) {
      mergedTextRow(`${t.currency}: ${data.currencyCode ?? "—"}`);
      mergedTextRow(`${t.paymentTerms}: ${data.paymentTerms ?? "—"}`);
      if (data.paymentMethod) {
        mergedTextRow(`${t.paymentMethod}: ${data.paymentMethod}`);
      }
      mergedTextRow(`${t.partialShipmentAllowed}: ${data.partialShipmentAllowed ? t.allowed : t.notAllowed}`);
      mergedTextRow(`${t.legalEffect}: ${legalEffectLine(formatDate(data.proposalValidityDate, lang), lang)}`);
      if (data.documentsChecklist.length > 0) {
        const docLabels = data.documentsChecklist
          .map((key) => t[DOCUMENT_CHECKLIST_LABEL_KEY[key as keyof typeof DOCUMENT_CHECKLIST_LABEL_KEY]])
          .join(" · ");
        mergedTextRow(`${t.documentsChecklist}: ${docLabels}`);
      }
      if (data.serviceTest || data.serviceFieldService || data.serviceDesign || data.warrantyTerms) {
        r += 1;
        sheet.mergeCells(r, 1, r, colCount);
        const headingCell = sheet.getCell(r, 1);
        headingCell.value = t.otherServices;
        headingCell.font = { bold: true, color: { argb: "FF1F3A5F" } };
        headingCell.alignment = { horizontal: align, vertical: "middle" };
        r += 1;
        mergedTextRow(
          [
            `${t.serviceTest}: ${data.serviceTest ?? "—"}`,
            `${t.serviceFieldService}: ${data.serviceFieldService ?? "—"}`,
            `${t.serviceDesign}: ${data.serviceDesign ?? "—"}`,
            `${t.warranty}: ${data.warrantyTerms ?? "—"}`,
          ].join("   |   "),
        );
      }
      if (data.remarks) {
        mergedTextRow(`${t.remarks}: ${data.remarks}`);
      }
    }
    r += 1;

    mergedTextRow(
      [
        `${lang === "fa" ? "آدرس" : "Address"}: ${sellerAddress}`,
        `${lang === "fa" ? "کد پستی" : "Postal Code"}: ${data.ourEntity?.postalCode ?? "—"}`,
        `${lang === "fa" ? "شماره ثبت" : "Registration No."}: ${data.ourEntity?.registrationNumber ?? "—"}`,
        `${lang === "fa" ? "ایمیل" : "Email"}: ${data.ourEntity?.email ?? "—"}`,
        `${lang === "fa" ? "تلفن" : "Phone"}: ${data.ourEntity?.phone ?? "—"}`,
      ].join("   |   "),
      { size: 9, color: "FF666666" },
    );

    mergedTextRow(
      [
        `${t.salesExpertContact} (${salesExpertName})`,
        `${t.extension}: ${data.salesExpertExtension ?? "—"}`,
        `${t.mobile}: ${data.salesExpertMobile ?? "—"}`,
        `${lang === "fa" ? "ایمیل" : "Email"}: ${data.salesExpertEmail ?? "—"}`,
      ].join("   |   "),
      { size: 9, color: "FF666666" },
    );

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
