import { buildProposalHtml } from "./html-template.builder";
import { ProposalDocumentData } from "./proposal-document-data.type";

function baseData(kind: "financial" | "technical"): ProposalDocumentData {
  return ({
    kind,
    proposalId: "prop-1",
    proposalNumber: "INQ-2026-0001-FIN-v1",
    version: 1,
    preparedDate: new Date("2026-01-01"),
    proposalValidityDate: null,
    currencyCode: kind === "financial" ? "EUR" : null,
    chosenDeliveryTerm: "EXW",
    deliveryDays: 30,
    deliveryDaysUnit: "day",
    incotermLocation: null,
    shippingMethod: null,
    paymentTerms: null,
    exchangeRateFromCurrency: null,
    exchangeRateToCurrency: null,
    exchangeRateValue: null,
    paymentMethod: null,
    partialShipmentAllowed: true,
    documentsChecklist: [],
    serviceTest: null,
    serviceFieldService: null,
    serviceDesign: null,
    warrantyTerms: null,
    remarks: null,
    salesExpertExtension: null,
    salesExpertMobile: null,
    salesExpertEmail: null,
    clientReference: "REF-1",
    ourEntity: {
      id: "e1",
      entityName: "پولاد تجهیز آپادانا",
      entityNameEn: "Poulad Tajhiz Apadana",
      shortCode: "پ ت",
      calendarType: "jalali",
      country: "ایران",
      status: "active",
      address: "تهران",
      addressEn: "Tehran",
      phone: "021",
      email: "info@example.com",
      website: null,
      logoUrl: null,
      postalCode: "12345",
      registrationNumber: "999",
    } as never,
    items: [
      {
        rowIndex: 1,
        partNumber: "PN-1",
        description: "گیربکس",
        builder: "Siemens",
        countryOfOrigin: "Germany",
        quantity: 2,
        measurementUnit: "عدد",
        technicalSpecs: "IP65، ولتاژ ۴۰۰ ولت",
        isEquivalent: true,
        unitPrice: kind === "financial" ? 100 : null,
        totalPrice: kind === "financial" ? 200 : null,
      },
    ],
    totalAmount: kind === "financial" ? 200 : null,
    buyer: {
      companyName: "ذوب آهن",
      companyNameEn: null,
      address: "اصفهان",
      addressEn: null,
      phone: "0311234567",
      email: "info@zobahan.example",
    } as never,
    buyerContact: null,
    salesExpertName: "سارا رضایی",
    salesExpertNameEn: "Sara Rezaei",
    inquiryNumber: "REF-1",
    internalNumber: "INQ-2026-0001",
  } as unknown) as ProposalDocumentData;
}

describe("buildProposalHtml", () => {
  it("فاز ۳۸: نسخه مالی ستون‌های قیمت واحد/قیمت کل رو داره", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toContain("قیمت واحد");
    expect(html).toContain("قیمت کل");
    expect(html).toContain("۲۰۰"); // جمع کل (فارسی، رقم فارسی)
  });

  it("فاز ۳۸: نسخه فنی هیچ ستون قیمتی نداره (طبق درخواست کاربر)", () => {
    const html = buildProposalHtml(baseData("technical"), "fa", null, null);
    expect(html).not.toContain("قیمت واحد");
    expect(html).not.toContain("قیمت کل");
    expect(html).not.toContain("جمع کل");
  });

  it("فاز ۳۸: زبان انگلیسی — dir=ltr و از entityNameEn/companyNameEn استفاده می‌کنه", () => {
    const html = buildProposalHtml(baseData("financial"), "en", null, null);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("Poulad Tajhiz Apadana");
  });

  it("فاز ۳۸: زبان فارسی — dir=rtl و از entityName فارسی استفاده می‌کنه", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("پولاد تجهیز آپادانا");
  });

  it("فاز ۵۶: وقتی deliveryDaysUnit=week باشه، سند به هفته نشون می‌ده نه به روز (باگ واقعی)", () => {
    const data = { ...baseData("financial"), deliveryDays: 21, deliveryDaysUnit: "week" as const };
    const faHtml = buildProposalHtml(data, "fa", null, null);
    const enHtml = buildProposalHtml(data, "en", null, null);
    expect(faHtml).toContain("(3 هفته)");
    expect(enHtml).toContain("(3 weeks)");
    expect(faHtml).not.toContain("(21 روز)");
  });

  it("فاز ۵۶: وقتی deliveryDaysUnit=day باشه (پیش‌فرض)، سند همچنان به روز نشون می‌ده", () => {
    const data = { ...baseData("financial"), deliveryDays: 21, deliveryDaysUnit: "day" as const };
    const html = buildProposalHtml(data, "fa", null, null);
    expect(html).toContain("(21 روز)");
  });

  it("فاز ۳۹: عنوان ستون کشور سازنده به CO خلاصه شده", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toContain(">CO<");
    expect(html).not.toContain("کشور سازنده");
  });

  it("فاز ۵۴: ستون سازنده مستقل، بلافاصله قبل از CO، هم در پیشنهاد مالی هم فنی درج می‌شه", () => {
    const financialHtml = buildProposalHtml(baseData("financial"), "fa", null, null);
    const technicalHtml = buildProposalHtml(baseData("technical"), "fa", null, null);
    // ترتیب ستون‌های سربرگ: ... <th>برند/سازنده</th><th>CO</th> ...
    expect(financialHtml).toMatch(/<th>برند\/سازنده<\/th>\s*<th>CO<\/th>/);
    expect(technicalHtml).toMatch(/<th>برند\/سازنده<\/th>\s*<th>CO<\/th>/);
    // مقدار واقعی سازنده (از baseData) در سلول ردیف قلم درج شده — نه فقط در ردیف شرح
    expect(financialHtml).toContain("<td>Siemens</td>");
    expect(technicalHtml).toContain("<td>Siemens</td>");
  });

  it("فاز ۳۹: کنار مبلغ‌ها نماد ارز نشون داده می‌شه (€ برای EUR)", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toContain("€");
  });

  it("فاز ۴۴: description (که از سرور همون شرح فنی تأمین‌کننده‌ست) + نشان «معادل» در ردیف قلم درج می‌شه", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toContain("گیربکس");
    expect(html).toContain("معادل");
  });

  it("فاز ۳۹: در نسخه انگلیسی، آدرس شرکت و نام کارشناس استعلام از فیلدهای انگلیسی میاد", () => {
    const html = buildProposalHtml(baseData("financial"), "en", null, null);
    expect(html).toContain("Tehran");
    expect(html).toContain("Sara Rezaei");
  });

  it("فاز ۳۹: در نسخه انگلیسی، واحد کالا معادل انگلیسی نشون داده می‌شه", () => {
    const html = buildProposalHtml(baseData("financial"), "en", null, null);
    expect(html).toContain("pcs");
  });

  it("فاز ۳۹: فیلد «کارشناس طرف خریدار» دیگه در سند نمایش داده نمی‌شه", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).not.toContain("کارشناس طرف خریدار");
  });

  it("فاز ۴۰-د: عنوان سند در بلوک مستقل و وسط‌چین بالای صفحه قرار می‌گیره", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toMatch(/<div class="doc-title"><h1>پیش‌فاکتور<\/h1><\/div>/);
  });

  it("فاز ۵۵: عنوان انگلیسی سند پیشنهاد مالی «Commercial Offer» است (نه Proforma Invoice)", () => {
    const html = buildProposalHtml(baseData("financial"), "en", null, null);
    expect(html).toMatch(/<div class="doc-title"><h1>Commercial Offer<\/h1><\/div>/);
    expect(html).not.toContain("<h1>Proforma Invoice</h1>");
  });

  it("فاز ۵۵: عنوان انگلیسی سند پیشنهاد فنی «Technical Offer» است (نه Commercial Offer)", () => {
    const html = buildProposalHtml(baseData("technical"), "en", null, null);
    expect(html).toMatch(/<div class="doc-title"><h1>Technical Offer<\/h1><\/div>/);
    expect(html).not.toContain("<h1>Commercial Offer</h1>");
  });

  it("فاز ۴۰-گ: وقتی barcodeDataUri داده بشه، تصویر بارکد در سند درج می‌شه", () => {
    const withBarcode = buildProposalHtml(baseData("financial"), "fa", null, "data:image/png;base64,AAAA");
    expect(withBarcode).toContain('<div class="header-barcode">');
    expect(withBarcode).toContain("data:image/png;base64,AAAA");

    const withoutBarcode = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(withoutBarcode).not.toMatch(/<div class="header-barcode">/);
  });

  it("فاز ۵۰-ب: تصویر بارکد یک max-width داره تا کوتاه‌تر نمایش داده بشه", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, "data:image/png;base64,AAAA");
    expect(html).toMatch(/\.header-barcode img \{[^}]*max-width:\s*160px/);
  });

  it("فاز ۵۰-ج: شماره تلفن و ایمیل خریدار در باکس مربوطه نوشته می‌شه", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).toContain("0311234567");
    expect(html).toContain("info@zobahan.example");
  });

  it("فاز ۵۰-ج: وقتی کارشناس طرف مشتری وجود داره، برچسب «کارشناس» + نامش در باکس خریدار درج می‌شه", () => {
    const data = baseData("financial");
    (data as unknown as { buyerContact: unknown }).buyerContact = {
      contactName: "علی محمدی",
      contactNameEn: "Ali Mohammadi",
    };

    const html = buildProposalHtml(data, "fa", null, null);
    expect(html).toContain("<b>کارشناس:</b> علی محمدی");
  });

  it("فاز ۵۰-ج: وقتی کارشناس طرف مشتری ثبت نشده، خط کارشناس اصلاً نشون داده نمی‌شه", () => {
    const html = buildProposalHtml(baseData("financial"), "fa", null, null);
    expect(html).not.toContain("<b>کارشناس:</b>");
  });
});
