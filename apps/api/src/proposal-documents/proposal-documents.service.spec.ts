import { ProposalDocumentsService } from "./proposal-documents.service";
import { ProposalService } from "../proposal/proposal.service";
import { StorageService } from "../files/storage.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { ExcelRendererService } from "./excel-renderer.service";

function buildDocumentData(kind: "financial" | "technical") {
  return {
    kind,
    proposalId: "prop-1",
    proposalNumber: "2026-پ ت-0007",
    version: 1,
    preparedDate: new Date("2026-01-01"),
    proposalValidityDate: null,
    currencyCode: kind === "financial" ? "EUR" : null,
    chosenDeliveryTerm: "EXW",
    deliveryDays: 30,
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
      id: "entity-1",
      entityName: "پولاد تجهیز آپادانا",
      entityNameEn: "Poulad Tajhiz Apadana",
      logoUrl: null,
      address: "تهران",
      phone: "021",
      email: "info@example.com",
      postalCode: "12345",
      registrationNumber: "999",
    },
    items: [
      {
        rowIndex: 1,
        partNumber: "PN-1",
        description: "گیربکس",
        builder: "Siemens",
        countryOfOrigin: "Germany",
        quantity: 2,
        measurementUnit: "عدد",
        unitPrice: kind === "financial" ? 100 : null,
        totalPrice: kind === "financial" ? 200 : null,
      },
    ],
    totalAmount: kind === "financial" ? 200 : null,
    buyer: { companyName: "ذوب آهن", companyNameEn: null, address: "اصفهان", addressEn: null },
    buyerContact: null,
    salesExpertName: "سارا رضایی",
    inquiryNumber: "REF-1",
    internalNumber: "INQ-2026-0001",
  };
}

function buildDeps(kind: "financial" | "technical") {
  const proposalService = {
    getDocumentData: jest.fn().mockResolvedValue(buildDocumentData(kind)),
    setFinancialFile: jest.fn().mockResolvedValue(undefined),
    setTechnicalFile: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    readBuffer: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({ fileUrl: "2026/07/generated.pdf", fileName: "generated.pdf" }),
  };
  const pdfRenderer = { renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")) };
  const excelRenderer = { render: jest.fn().mockResolvedValue(Buffer.from("xlsx")) };
  return { proposalService, storage, pdfRenderer, excelRenderer };
}

describe("ProposalDocumentsService", () => {
  it("فرمت pdf: HTML رو با puppeteer رندر می‌کنه و فایل رو با storage.save ذخیره می‌کنه", async () => {
    const deps = buildDeps("financial");
    const service = new ProposalDocumentsService(
      deps.proposalService as unknown as ProposalService,
      deps.storage as unknown as StorageService,
      deps.pdfRenderer as unknown as PdfRendererService,
      deps.excelRenderer as unknown as ExcelRendererService,
    );

    const result = await service.generate("inq-1", "financial", "pdf", "fa");

    // فاز ۶۰ — generate() حالا یک deliveryOptionId اختیاری هم به getDocumentData پاس می‌ده
    // (اینجا undefined چون کوئری‌پارام تعیین نشده، یعنی مسیر قدیمی تک‌گزینه‌ای)
    expect(deps.proposalService.getDocumentData).toHaveBeenCalledWith("inq-1", "financial", undefined);
    expect(deps.pdfRenderer.renderHtmlToPdf).toHaveBeenCalled();
    expect(deps.excelRenderer.render).not.toHaveBeenCalled();
    expect(deps.storage.save).toHaveBeenCalledWith(
      expect.stringContaining(".pdf"),
      expect.any(Buffer),
      expect.objectContaining({ folderHint: "INQ-2026-0001", preferredBaseName: expect.stringContaining("Commercial Offer") }),
    );
    expect(deps.proposalService.setFinancialFile).toHaveBeenCalledWith("inq-1", "2026/07/generated.pdf");
    expect(deps.proposalService.setTechnicalFile).not.toHaveBeenCalled();
    expect(result).toEqual({ fileUrl: "2026/07/generated.pdf", fileName: expect.stringContaining(".pdf") });
  });

  it("فرمت xlsx: از ExcelRendererService استفاده می‌کنه، نه puppeteer", async () => {
    const deps = buildDeps("technical");
    const service = new ProposalDocumentsService(
      deps.proposalService as unknown as ProposalService,
      deps.storage as unknown as StorageService,
      deps.pdfRenderer as unknown as PdfRendererService,
      deps.excelRenderer as unknown as ExcelRendererService,
    );

    await service.generate("inq-1", "technical", "xlsx", "en");

    expect(deps.excelRenderer.render).toHaveBeenCalled();
    expect(deps.pdfRenderer.renderHtmlToPdf).not.toHaveBeenCalled();
    expect(deps.proposalService.setTechnicalFile).toHaveBeenCalledWith("inq-1", "2026/07/generated.pdf");
    expect(deps.proposalService.setFinancialFile).not.toHaveBeenCalled();
  });

  it("وقتی لوگو ندارد readBuffer صدا زده نمی‌شه (چون logoUrl=null)", async () => {
    const deps = buildDeps("financial");
    const service = new ProposalDocumentsService(
      deps.proposalService as unknown as ProposalService,
      deps.storage as unknown as StorageService,
      deps.pdfRenderer as unknown as PdfRendererService,
      deps.excelRenderer as unknown as ExcelRendererService,
    );

    await service.generate("inq-1", "financial", "pdf", "fa");

    expect(deps.storage.readBuffer).not.toHaveBeenCalled();
  });

  it("فاز ۴۰-گ: هر دو فرمت PDF و اکسل، بارکد شماره پیشنهاد رو به رندرر پاس می‌دن", async () => {
    const deps = buildDeps("financial");
    const service = new ProposalDocumentsService(
      deps.proposalService as unknown as ProposalService,
      deps.storage as unknown as StorageService,
      deps.pdfRenderer as unknown as PdfRendererService,
      deps.excelRenderer as unknown as ExcelRendererService,
    );

    await service.generate("inq-1", "financial", "xlsx", "fa");

    const [, , , barcodeArg] = deps.excelRenderer.render.mock.calls[0];
    expect(Buffer.isBuffer(barcodeArg)).toBe(true);
    expect((barcodeArg as Buffer).length).toBeGreaterThan(0);
  });
});
