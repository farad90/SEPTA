import { describe, expect, it } from "vitest";
import { mimeFromExtension, resolveDownloadName } from "./FileViewer";

describe("mimeFromExtension", () => {
  it("detects image types", () => {
    expect(mimeFromExtension("photo.png")).toBe("image/png");
    expect(mimeFromExtension("photo.JPG")).toBe("image/jpeg");
    expect(mimeFromExtension("photo.jpeg")).toBe("image/jpeg");
    expect(mimeFromExtension("photo.webp")).toBe("image/webp");
  });

  it("detects pdf", () => {
    expect(mimeFromExtension("contract.pdf")).toBe("application/pdf");
  });

  it("falls back to octet-stream for non-previewable/unknown extensions", () => {
    expect(mimeFromExtension("file.docx")).toBe("application/octet-stream");
    expect(mimeFromExtension("file.xlsx")).toBe("application/octet-stream");
    expect(mimeFromExtension("file.dwg")).toBe("application/octet-stream");
    expect(mimeFromExtension("noextension")).toBe("application/octet-stream");
  });
});

describe("resolveDownloadName", () => {
  it("فاز ۳۹: وقتی fileName برچسب ثابت بدون پسونده، پسوند واقعی fileUrl بهش اضافه می‌شه", () => {
    expect(resolveDownloadName("2026/07/generated.pdf", "فایل پیشنهاد")).toBe("فایل پیشنهاد.pdf");
    expect(resolveDownloadName("2026/07/contract.docx", "فایل قرارداد")).toBe("فایل قرارداد.docx");
  });

  it("اگه fileName خودش پسوند داشت، دست‌نخورده می‌مونه", () => {
    expect(resolveDownloadName("2026/07/xyz.pdf", "invoice-2026.pdf")).toBe("invoice-2026.pdf");
  });

  it("اگه fileUrl هم پسوند نداشت، همون fileName خام برمی‌گرده", () => {
    expect(resolveDownloadName("2026/07/noext", "فایل عجیب")).toBe("فایل عجیب");
  });
});
