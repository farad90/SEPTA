import { format as formatJalaliDate } from "date-fns-jalali";
import { ProposalDocumentData } from "./proposal-document-data.type";
import { formatMoney, translateUnit } from "./format-helpers";

export type ProposalDocLang = "fa" | "en";

const LABELS = {
  fa: {
    financialTitle: "پیش‌فاکتور",
    technicalTitle: "پیشنهاد فنی",
    seller: "فروشنده",
    buyer: "خریدار",
    destination: "مقصد",
    partyName: "نام شرکت",
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
    generalNotes: "سایر ملاحظات",
    footerAddress: "آدرس",
    footerPostalCode: "کد پستی",
    footerRegistrationNumber: "شماره ثبت",
    footerEmail: "ایمیل",
    footerPhone: "تلفن",
    salesExpertContact: "مشخصات کارشناس فروش",
    extension: "داخلی",
    mobile: "موبایل",
    noPriceNote: "قیمت اقلام صرفاً در نسخه پیش‌فاکتور (پیشنهاد مالی) ارائه می‌شود.",
    equivalentTag: "معادل",
    docInvoiceCopy: "کپی اینویس",
    docPackingList: "پکینگ لیست",
    docManufacturerTestCertificate: "گواهی تست سازنده",
    docCertificateOfOrigin: "گواهی مبدأ",
    docOtherOnRequest: "سایر گواهی‌های قابل ارائه بنا به درخواست",
  },
  en: {
    // فاز ۵۵ — بازخورد کاربر: نام‌گذاری اصلاح شد — مالی (قیمت‌دار) = Commercial Offer،
    // فنی (بدون قیمت) = Technical Offer؛ دقیقاً هم‌راستا با kindLabel که در
    // proposal-documents.service.ts برای نام‌گذاری فایل از قبل همین قاعده رو داشت
    financialTitle: "Commercial Offer",
    technicalTitle: "Technical Offer",
    seller: "Seller",
    buyer: "Buyer",
    destination: "Destination",
    partyName: "Company Name",
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
    generalNotes: "Notes",
    footerAddress: "Address",
    footerPostalCode: "Postal Code",
    footerRegistrationNumber: "Registration No.",
    footerEmail: "Email",
    footerPhone: "Phone",
    salesExpertContact: "Sales Expert Contact",
    extension: "Ext.",
    mobile: "Mobile",
    noPriceNote: "Item prices are only included in the Commercial Offer (financial proposal).",
    equivalentTag: "Equivalent",
    docInvoiceCopy: "Invoice Copy",
    docPackingList: "Packing List",
    docManufacturerTestCertificate: "Manufacturer Test Certificate",
    docCertificateOfOrigin: "Certificate of Origin",
    docOtherOnRequest: "Other certificates available upon request",
  },
} as const;

// عرض ستون‌ها ثابته (table-layout:fixed) — محتوای بلند به‌جای بزرگ‌کردن ستون، چندسطری می‌شه
// ⚠️ فاز ۵۳ — چینش جدول اقلام مطابق قالب مرجع پیوستی بازطراحی شد: هر قلم حالا یک ردیفِ
// فشرده (ردیف/پارت‌نامبر/مقدار/واحد/برند/CO/[قیمت]) + یک ردیفِ تمام‌عرض برای شرح کالا زیرش داره.
// فاز ۵۴ — بازخورد کاربر: ستون برند/سازنده باید کنار CO باشه (نه فقط توی ردیف شرح) — برگردوندن
// یک ستون مستقل، بلافاصله قبل از CO، هم در پیشنهاد مالی هم فنی
const FINANCIAL_COL_WIDTHS = [6, 13, 9, 9, 13, 9, 19, 22];
const TECHNICAL_COL_WIDTHS = [8, 20, 13, 13, 18, 28];
const FINANCIAL_COL_COUNT = FINANCIAL_COL_WIDTHS.length;
const TECHNICAL_COL_COUNT = TECHNICAL_COL_WIDTHS.length;

const DOCUMENT_CHECKLIST_LABEL_KEY = {
  invoice_copy: "docInvoiceCopy",
  packing_list: "docPackingList",
  manufacturer_test_certificate: "docManufacturerTestCertificate",
  certificate_of_origin: "docCertificateOfOrigin",
  other_on_request: "docOtherOnRequest",
} as const;

function formatDate(date: Date | null, lang: ProposalDocLang): string {
  if (!date) return "—";
  return lang === "fa" ? formatJalaliDate(date, "yyyy/MM/dd") : date.toISOString().slice(0, 10);
}

function esc(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** نسخه فارسی همیشه از فیلد فارسی، نسخه انگلیسی از فیلد *_en اگر پر باشه، وگرنه fallback به فارسی */
function bilingual(fa: string | null | undefined, en: string | null | undefined, lang: ProposalDocLang): string {
  if (lang === "en") return esc(en || fa);
  return esc(fa);
}

/**
 * فاز ۵۶ — بازخورد کاربر (باگ واقعی): تا اینجا واحد انتخابی کاربر (روز/هفته) در
 * DeliveryTimeInput هیچ‌جا ذخیره نمی‌شد و سند همیشه به روز نشون می‌داد. این تابع همون
 * تبدیل/رند کردنی که خودِ DeliveryTimeInput موقع تایپ انجام می‌ده رو دقیقاً تکرار می‌کنه
 * تا عددی که کاربر دیده، عیناً در سند هم دیده بشه.
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

/** جمله ثابت اعتبار قانونی — بر مبنای تاریخ اعتبار پیشنهاد که از قبل در سند موجوده، نه داده تازه */
function legalEffectLine(validUntil: string, lang: ProposalDocLang): string {
  return lang === "fa"
    ? `این پیش‌فاکتور تا تاریخ ${validUntil} معتبر است و منوط به تأیید نهایی طرفین است.`
    : `This commercial offer is valid until ${validUntil} and is subject to final confirmation by both parties.`;
}

export function buildProposalHtml(
  data: ProposalDocumentData,
  lang: ProposalDocLang,
  logoDataUri: string | null,
  barcodeDataUri: string | null,
): string {
  const t = LABELS[lang];
  const dir = lang === "fa" ? "rtl" : "ltr";
  const isFinancial = data.kind === "financial";
  const title = isFinancial ? t.financialTitle : t.technicalTitle;

  const sellerName = bilingual(data.ourEntity?.entityName, data.ourEntity?.entityNameEn, lang);
  const sellerAddress = bilingual(data.ourEntity?.address, data.ourEntity?.addressEn, lang);
  const salesExpertName = bilingual(data.salesExpertName, data.salesExpertNameEn, lang);
  const buyerName = bilingual(data.buyer.companyName, data.buyer.companyNameEn, lang);
  const buyerAddress = bilingual(data.buyer.address, data.buyer.addressEn, lang);
  const buyerContactName = data.buyerContact
    ? bilingual(data.buyerContact.contactName, data.buyerContact.contactNameEn, lang)
    : null;
  const buyerIdNo = esc(data.buyer.taxId || data.buyer.registrationNumber);
  // مقصد محموله — از ترم/محل تحویل ثبت‌شده در همین پیشنهاد (در صورت وجود)، وگرنه آدرس خریدار
  const destinationAddress = data.incotermLocation ? esc(data.incotermLocation) : buyerAddress;
  const destinationTel = esc(data.buyerContact?.mobile || data.buyer.phone);

  const colCount = isFinancial ? FINANCIAL_COL_COUNT : TECHNICAL_COL_COUNT;
  const colWidths = isFinancial ? FINANCIAL_COL_WIDTHS : TECHNICAL_COL_WIDTHS;
  const colgroup = `<colgroup>${colWidths.map((w) => `<col style="width:${w}%" />`).join("")}</colgroup>`;

  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td>${item.rowIndex}</td>
        <td>${esc(item.partNumber)}</td>
        <td>${item.quantity}</td>
        <td>${esc(translateUnit(item.measurementUnit, lang))}</td>
        <td>${esc(item.builder)}</td>
        <td>${esc(item.countryOfOrigin)}</td>
        ${
          isFinancial
            ? `<td>${formatMoney(item.unitPrice, data.currencyCode, lang)}</td><td>${formatMoney(item.totalPrice, data.currencyCode, lang)}</td>`
            : ""
        }
      </tr>
      <tr class="desc-row">
        <td class="desc" colspan="${colCount}">
          ${esc(item.description)}${item.isEquivalent ? ` <span class="tag">${t.equivalentTag}</span>` : ""}
        </td>
      </tr>`,
    )
    .join("");

  const priceHeaders = isFinancial ? `<th>${t.unitPrice}</th><th>${t.totalPrice}</th>` : "";

  const documentsLine =
    isFinancial && data.documentsChecklist.length > 0
      ? `<div class="detail-line"><b>${t.documentsChecklist}:</b> ${data.documentsChecklist
          .map((key) => esc(t[DOCUMENT_CHECKLIST_LABEL_KEY[key as keyof typeof DOCUMENT_CHECKLIST_LABEL_KEY]]))
          .join(" · ")}</div>`
      : "";

  const legalEffectDiv =
    isFinancial
      ? `<div class="detail-line"><b>${t.legalEffect}:</b> ${legalEffectLine(formatDate(data.proposalValidityDate, lang), lang)}</div>`
      : "";

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<style>
  @import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap");
  * { box-sizing: border-box; }
  body {
    font-family: ${lang === "fa" ? "'Vazirmatn', sans-serif" : "Arial, Helvetica, sans-serif"};
    font-size: 12px;
    color: #1a1a1a;
    margin: 0;
    padding: 32px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1F3A5F; padding-bottom: 12px; margin-bottom: 12px; gap: 16px; }
  .header-logo { display: flex; flex-direction: column; align-items: ${lang === "fa" ? "flex-end" : "flex-start"}; gap: 6px; }
  .header-logo img { max-height: 192px; max-width: 600px; object-fit: contain; }
  .header-right { display: flex; flex-direction: column; align-items: ${lang === "fa" ? "flex-start" : "flex-end"}; gap: 8px; }
  .header-barcode { text-align: center; }
  .header-barcode img { height: 40px; max-width: 160px; }
  .header-meta { text-align: ${lang === "fa" ? "left" : "right"}; font-size: 11px; }
  .header-meta div { margin-bottom: 2px; }
  .header-meta b { color: #1F3A5F; }
  .doc-title { text-align: center; margin-bottom: 14px; }
  .doc-title h1 { font-size: 26px; margin: 0; color: #1F3A5F; letter-spacing: 0.5px; }
  .parties { display: flex; gap: 16px; margin-bottom: 16px; }
  .party-box { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
  .party-box h3 { margin: 0 0 6px; font-size: 12px; color: #A9633B; text-transform: uppercase; }
  .party-box p { margin: 0 0 3px; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; word-wrap: break-word; overflow-wrap: break-word; }
  th { background: #1F3A5F; color: #fff; font-weight: 600; }
  tr.desc-row td.desc { text-align: ${lang === "fa" ? "right" : "left"}; border-top: none; }
  td.desc .tag { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 8px; background: #F3E6DC; color: #A9633B; font-weight: 600; }
  tfoot td { font-weight: 700; background: #F3E6DC; }
  .details { margin-bottom: 16px; }
  .detail-line { border: 1px solid #ddd; border-top: none; padding: 6px 10px; font-size: 11px; }
  .details .detail-line:first-child { border-top: 1px solid #ddd; border-radius: 6px 6px 0 0; }
  .details .detail-line:last-child { border-radius: 0 0 6px 6px; }
  .note { font-size: 10px; color: #777; margin-top: 4px; }
  .other-services h4 { font-size: 12px; color: #1F3A5F; margin: 0 0 6px; }
  footer { border-top: 1px solid #ddd; padding-top: 8px; margin-top: 24px; font-size: 10px; color: #555; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 18px; }
  footer .footer-fields { display: flex; flex-wrap: wrap; gap: 4px 18px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-logo">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="logo" />` : ""}
      <div><b>${sellerName}</b></div>
    </div>
    <div class="header-right">
      ${barcodeDataUri ? `<div class="header-barcode"><img src="${barcodeDataUri}" alt="barcode" /></div>` : ""}
      <div class="header-meta">
        <div><b>${isFinancial ? t.proposalNumber : t.technicalNumber}:</b> ${esc(data.proposalNumber)}</div>
        <div><b>${t.proposalDate}:</b> ${formatDate(data.preparedDate, lang)}</div>
        <div><b>${t.inquiryNumber}:</b> ${esc(data.clientReference || data.internalNumber)}</div>
        <div><b>${t.customerNo}:</b> ${esc(data.buyer.registrationNumber)}</div>
        ${isFinancial ? `<div><b>${t.validUntil}:</b> ${formatDate(data.proposalValidityDate, lang)}</div>` : ""}
        <div><b>${t.salesExpert}:</b> ${salesExpertName}</div>
      </div>
    </div>
  </div>

  <div class="doc-title"><h1>${title}</h1></div>

  <div class="parties">
    <div class="party-box">
      <h3>${t.buyer}</h3>
      <p><b>${t.partyName}:</b> ${buyerName}</p>
      <p><b>${t.idNo}:</b> ${buyerIdNo}</p>
      <p><b>${t.footerAddress}:</b> ${buyerAddress}</p>
      <p><b>${t.footerPhone}:</b> ${esc(data.buyer.phone)}</p>
      <p>${esc(data.buyer.email)}</p>
      ${buyerContactName ? `<p><b>${t.buyerContact}:</b> ${buyerContactName}</p>` : ""}
    </div>
    <div class="party-box">
      <h3>${t.destination}</h3>
      <p><b>${t.partyName}:</b> ${buyerName}</p>
      <p><b>${t.idNo}:</b> ${buyerIdNo}</p>
      <p><b>${t.footerAddress}:</b> ${destinationAddress}</p>
      <p><b>${t.footerPhone}:</b> ${destinationTel}</p>
    </div>
  </div>

  <table>
    ${colgroup}
    <thead>
      <tr>
        <th>${t.row}</th>
        <th>${t.partNumber}</th>
        <th>${t.quantity}</th>
        <th>${t.unit}</th>
        <th>${t.builder}</th>
        <th>${t.countryOfOrigin}</th>
        ${priceHeaders}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    ${
      isFinancial
        ? `<tfoot>
            <tr><td colspan="${colCount - 1}">${t.sumTotal}</td><td>${formatMoney(data.totalAmount, data.currencyCode, lang)}</td></tr>
            <tr><td colspan="${colCount - 1}">${t.otherCostsSummary}</td><td>—</td></tr>
            <tr><td colspan="${colCount - 1}">${t.totalAmount}</td><td>${formatMoney(data.totalAmount, data.currencyCode, lang)}</td></tr>
          </tfoot>`
        : ""
    }
  </table>
  ${!isFinancial ? `<p class="note">${t.noPriceNote}</p>` : ""}

  <div class="details">
    <div class="detail-line"><b>${t.deliveryTerm}:</b> ${esc(data.chosenDeliveryTerm)}${
      data.incotermLocation ? ` — ${esc(data.incotermLocation)}` : ""
    } ${data.deliveryDays != null ? `(${formatDeliveryDuration(data.deliveryDays, data.deliveryDaysUnit, lang)})` : ""}</div>
    ${data.shippingMethod ? `<div class="detail-line"><b>${t.shippingMethod}:</b> ${esc(data.shippingMethod)}</div>` : ""}
    ${isFinancial ? `<div class="detail-line"><b>${t.currency}:</b> ${esc(data.currencyCode)}</div>` : ""}
    ${isFinancial ? `<div class="detail-line"><b>${t.paymentTerms}:</b> ${esc(data.paymentTerms)}</div>` : ""}
    ${isFinancial && data.paymentMethod ? `<div class="detail-line"><b>${t.paymentMethod}:</b> ${esc(data.paymentMethod)}</div>` : ""}
    ${
      isFinancial
        ? `<div class="detail-line"><b>${t.partialShipmentAllowed}:</b> ${data.partialShipmentAllowed ? t.allowed : t.notAllowed}</div>`
        : ""
    }
    ${legalEffectDiv}
    ${documentsLine}
    ${isFinancial && data.remarks ? `<div class="detail-line"><b>${t.remarks}:</b> ${esc(data.remarks)}</div>` : ""}
  </div>

  ${
    isFinancial && (data.serviceTest || data.serviceFieldService || data.serviceDesign || data.warrantyTerms)
      ? `<div class="other-services">
          <h4>${t.otherServices}</h4>
          <table>
            <thead><tr><th>${t.serviceTest}</th><th>${t.serviceFieldService}</th><th>${t.serviceDesign}</th><th>${t.warranty}</th></tr></thead>
            <tbody><tr>
              <td>${esc(data.serviceTest)}</td>
              <td>${esc(data.serviceFieldService)}</td>
              <td>${esc(data.serviceDesign)}</td>
              <td>${esc(data.warrantyTerms)}</td>
            </tr></tbody>
          </table>
        </div>`
      : ""
  }

  <footer>
    <div class="footer-fields">
      <span><b>${t.footerAddress}:</b> ${sellerAddress}</span>
      <span><b>${t.footerPostalCode}:</b> ${esc(data.ourEntity?.postalCode)}</span>
      <span><b>${t.footerRegistrationNumber}:</b> ${esc(data.ourEntity?.registrationNumber)}</span>
      <span><b>${t.footerEmail}:</b> ${esc(data.ourEntity?.email)}</span>
      <span><b>${t.footerPhone}:</b> ${esc(data.ourEntity?.phone)}</span>
    </div>
    <div class="footer-fields">
      <span><b>${t.salesExpertContact} (${salesExpertName}):</b></span>
      <span><b>${t.extension}:</b> ${esc(data.salesExpertExtension)}</span>
      <span><b>${t.mobile}:</b> ${esc(data.salesExpertMobile)}</span>
      <span><b>${t.footerEmail}:</b> ${esc(data.salesExpertEmail)}</span>
    </div>
  </footer>
</body>
</html>`;
}
