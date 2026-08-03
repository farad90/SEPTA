import { ProposalDocLang } from "./html-template.builder";

/** نماد ارز برای نمایش کنار مبلغ در اسناد پیشنهاد — طبق بازخورد کاربر (فاز ۳۹) */
const CURRENCY_SYMBOLS: Record<string, { symbol: string; position: "prefix" | "suffix" }> = {
  USD: { symbol: "$", position: "prefix" },
  EUR: { symbol: "€", position: "prefix" },
  GBP: { symbol: "£", position: "prefix" },
  CNY: { symbol: "¥", position: "prefix" },
  TRY: { symbol: "₺", position: "suffix" },
  PLN: { symbol: "zł", position: "suffix" },
  AED: { symbol: "د.إ", position: "suffix" },
};

function currencySymbolFor(currencyCode: string | null | undefined, lang: ProposalDocLang): string | null {
  if (!currencyCode) return null;
  if (currencyCode === "IRR") return lang === "fa" ? "ریال" : "IRR";
  const entry = CURRENCY_SYMBOLS[currencyCode];
  return entry?.symbol ?? currencyCode;
}

function currencySymbolPosition(currencyCode: string | null | undefined): "prefix" | "suffix" {
  if (!currencyCode || currencyCode === "IRR") return "suffix";
  return CURRENCY_SYMBOLS[currencyCode]?.position ?? "suffix";
}

/** مبلغ + نماد ارز کنار هم، مثلاً "$1,234.00" یا "1,234 ریال" */
export function formatMoney(value: number | null, currencyCode: string | null | undefined, lang: ProposalDocLang): string {
  if (value == null) return "—";
  const amount = value.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 2 });
  const symbol = currencySymbolFor(currencyCode, lang);
  if (!symbol) return amount;
  return currencySymbolPosition(currencyCode) === "prefix" ? `${symbol}${amount}` : `${amount} ${symbol}`;
}

/** معادل انگلیسی واحدهای اندازه‌گیری seed‌شده (measurement_units) — واحدهای سفارشی/ناشناخته fallback به همون متن فارسی */
const MEASUREMENT_UNIT_EN: Record<string, string> = {
  عدد: "pcs",
  کیلوگرم: "kg",
  گرم: "g",
  تن: "ton",
  متر: "m",
  "سانتی‌متر": "cm",
  مترمربع: "m²",
  لیتر: "L",
  دست: "set",
  بسته: "pack",
  رول: "roll",
  شاخه: "rod",
  ورق: "sheet",
  جفت: "pair",
  کارتن: "carton",
};

/** واحد کالا در اسناد فارسی، فارسی؛ در اسناد انگلیسی، معادل انگلیسی (یا خود متن فارسی اگه معادل نداشت) */
export function translateUnit(unit: string, lang: ProposalDocLang): string {
  if (lang === "fa") return unit;
  return MEASUREMENT_UNIT_EN[unit] ?? unit;
}
