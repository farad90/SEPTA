import { Injectable } from "@nestjs/common";
import type PuppeteerNS from "puppeteer";

// puppeteer یک بستهٔ ESM-only است — خروجی CommonJS این پروژه نمی‌تونه require() استاتیک کنه.
// import() معمولی هم توسط tsc به require() تبدیل می‌شه (چون module=commonjs)، پس همون خطا
// تکرار می‌شه؛ این ترفند import() رو داخل Function می‌ذاره تا tsc دستش نزنه و در Node واقعاً
// به‌صورت ESM دینامیک اجرا بشه.
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<{ default: typeof PuppeteerNS }>;

@Injectable()
export class PdfRendererService {
  async renderHtmlToPdf(html: string): Promise<Buffer> {
    const { default: puppeteer } = await dynamicImport("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluateHandle("document.fonts.ready");
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
