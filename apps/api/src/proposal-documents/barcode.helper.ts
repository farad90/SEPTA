import bwipjs from "bwip-js";

/**
 * فاز ۴۰-گ — بارکد Code128 برای شماره پیشنهاد، برای زیباتر شدن و شناسایی سریع سند.
 * فاز ۵۰-ب — بازخورد کاربر: بارکد کوتاه‌تر بشه؛ scale کاهش یافت (هم‌زمان با کوتاه‌تر شدن خود
 * متن شماره در فاز ۵۰-الف — بدون حرف و بر مبنای سال میلادی — عرض نهایی به‌طور محسوسی کمتر شد)
 */
export async function generateBarcodePng(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 2,
    height: 10,
    includetext: true,
    textxalign: "center",
  });
}

export async function generateBarcodeDataUri(text: string): Promise<string> {
  const png = await generateBarcodePng(text);
  return `data:image/png;base64,${png.toString("base64")}`;
}
