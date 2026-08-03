import ExcelJS from "exceljs";
import { ExcelRendererService } from "./excel-renderer.service";
import { ProposalDocumentData } from "./proposal-document-data.type";

function baseData(kind: "financial" | "technical"): ProposalDocumentData {
  return ({
    kind,
    proposalId: "prop-1",
    proposalNumber: "2026-پ ت-0007",
    version: 1,
    preparedDate: new Date("2026-01-01"),
    proposalValidityDate: null,
    currencyCode: kind === "financial" ? "USD" : null,
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
        technicalSpecs: "IP65",
        isEquivalent: false,
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

async function readBackText(buffer: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  const parts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value != null) parts.push(String(cell.value));
    });
  });
  return parts.join(" | ");
}

describe("ExcelRendererService", () => {
  const service = new ExcelRendererService();

  it("فاز ۴۰-ج: خروجی یک فایل xlsx معتبره و عنوان سند رو وسط‌چین در بالای صفحه داره", async () => {
    const buffer = await service.render(baseData("financial"), "fa", null, null);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const sheet = wb.worksheets[0];
    const titleCell = sheet.getCell(1, 1);
    expect(titleCell.value).toBe("پیش‌فاکتور");
    expect(titleCell.alignment?.horizontal).toBe("center");
  });

  it("فاز ۵۶: وقتی deliveryDaysUnit=week باشه، سند به هفته نشون می‌ده نه به روز (باگ واقعی)", async () => {
    const data = { ...baseData("financial"), deliveryDays: 21, deliveryDaysUnit: "week" as const };
    const buffer = await service.render(data, "fa", null, null);
    const text = await readBackText(buffer);
    expect(text).toContain("3 هفته");
    expect(text).not.toContain("21 روز");
  });

  it("فاز ۴۰-ج: نسخه مالی ستون‌های قیمت واحد/قیمت کل و نماد ارز رو داره", async () => {
    const buffer = await service.render(baseData("financial"), "fa", null, null);
    const text = await readBackText(buffer);
    expect(text).toContain("قیمت واحد");
    expect(text).toContain("قیمت کل");
    expect(text).toContain("$");
  });

  it("فاز ۴۰-ج: نسخه فنی هیچ ستون قیمتی نداره", async () => {
    const buffer = await service.render(baseData("technical"), "fa", null, null);
    const text = await readBackText(buffer);
    expect(text).not.toContain("قیمت واحد");
    expect(text).not.toContain("قیمت کل");
  });

  it("فاز ۵۴: ستون سازنده مستقل، بلافاصله قبل از CO، هم در پیشنهاد مالی هم فنی درج می‌شه", async () => {
    for (const kind of ["financial", "technical"] as const) {
      const buffer = await service.render(baseData(kind), "fa", null, null);
      const wb = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
      const sheet = wb.worksheets[0];

      let builderHeaderCol: number | null = null;
      let headerRowNumber: number | null = null;
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.value === "برند/سازنده") {
            builderHeaderCol = colNumber;
            headerRowNumber = rowNumber;
          }
        });
      });

      expect(builderHeaderCol).not.toBeNull();
      expect(sheet.getCell(headerRowNumber!, builderHeaderCol! + 1).value).toBe("CO");
      // مقدار واقعی سازنده (از baseData) هم در ردیف قلم زیر همون ستون درج شده
      const factRowValues = sheet.getRow(headerRowNumber! + 1).values as unknown[];
      expect(factRowValues[builderHeaderCol!]).toBe("Siemens");
    }
  });

  it("فاز ۵۵: عنوان انگلیسی سند پیشنهاد مالی «Commercial Offer» است (نه Proforma Invoice)", async () => {
    const buffer = await service.render(baseData("financial"), "en", null, null);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets[0].getCell(1, 1).value).toBe("Commercial Offer");
  });

  it("فاز ۵۵: عنوان انگلیسی سند پیشنهاد فنی «Technical Offer» است (نه Commercial Offer)", async () => {
    const buffer = await service.render(baseData("technical"), "en", null, null);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets[0].getCell(1, 1).value).toBe("Technical Offer");
  });

  it("فاز ۴۰-گ: وقتی بارکد داده بشه، به‌عنوان تصویر داخل فایل embed می‌شه", async () => {
    const barcode = Buffer.from([137, 80, 78, 71]); // fake PNG signature bytes
    const buffer = await service.render(baseData("financial"), "fa", null, barcode);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const sheet = wb.worksheets[0];
    expect(sheet.getImages().length).toBeGreaterThan(0);
  });

  it("فاز ۵۰-ب: تصویر بارکد با ابعاد کوچک‌تر (110×37) embed می‌شه", async () => {
    const barcode = Buffer.from([137, 80, 78, 71]);
    const buffer = await service.render(baseData("financial"), "fa", null, barcode);
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const sheet = wb.worksheets[0];
    const [image] = sheet.getImages();
    expect((image.range as unknown as { ext: { width: number; height: number } }).ext).toEqual({
      width: 110,
      height: 37,
    });
  });

  it("فاز ۵۰-ج: شماره تلفن و ایمیل خریدار در ردیف باکس خریدار نوشته می‌شه", async () => {
    const buffer = await service.render(baseData("financial"), "fa", null, null);
    const text = await readBackText(buffer);
    expect(text).toContain("0311234567");
    expect(text).toContain("info@zobahan.example");
  });

  it("فاز ۵۰-ج: وقتی کارشناس طرف مشتری وجود داره، برچسب «کارشناس» + نامش نوشته می‌شه", async () => {
    const data = baseData("financial");
    (data as unknown as { buyerContact: unknown }).buyerContact = {
      contactName: "علی محمدی",
      contactNameEn: "Ali Mohammadi",
    };

    const buffer = await service.render(data, "fa", null, null);
    const text = await readBackText(buffer);
    expect(text).toContain("کارشناس: علی محمدی");
  });
});
