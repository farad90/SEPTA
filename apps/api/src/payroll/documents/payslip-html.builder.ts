import { formatMoney } from "../../proposal-documents/format-helpers";
import { PayslipDocumentData } from "./payslip-document-data.type";

const STATUS_LABEL: Record<string, string> = {
  draft: "پیش‌نویس",
  calculated: "محاسبه‌شده",
  reviewed: "بازبینی‌شده",
  approved: "تأییدشده",
  posted: "ثبت حسابداری",
  locked: "قفل‌شده (نهایی)",
};

function esc(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(value: number, currencyCode: string): string {
  return formatMoney(value, currencyCode, "fa");
}

function itemsTable(data: PayslipDocumentData, type: "earning" | "deduction"): string {
  const rows = data.items.filter((item) => item.type === type);
  const label = type === "earning" ? "مزایا" : "کسورات";
  const bodyRows = rows
    .map((item) => `<tr><td class="desc">${esc(item.title)}</td><td>${money(item.amount, data.currencyCode)}</td></tr>`)
    .join("");

  const extraRows =
    type === "deduction"
      ? `<tr><td class="desc">حق بیمه سهم کارمند</td><td>${money(data.insuranceEmployeeShare, data.currencyCode)}</td></tr>
         <tr><td class="desc">مالیات</td><td>${money(data.taxAmount, data.currencyCode)}</td></tr>`
      : "";

  return `
  <table>
    <thead><tr><th class="desc">${label}</th><th>مبلغ</th></tr></thead>
    <tbody>${bodyRows}${extraRows}</tbody>
  </table>`;
}

export function buildPayslipHtml(data: PayslipDocumentData, logoDataUri: string | null): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  @import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap");
  * { box-sizing: border-box; }
  body { font-family: 'Vazirmatn', sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 32px; }
  .doc-title { text-align: center; margin-bottom: 14px; }
  .doc-title h1 { font-size: 24px; margin: 0; color: #1F3A5F; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1F3A5F; padding-bottom: 12px; margin-bottom: 16px; gap: 16px; }
  .header-logo img { max-height: 80px; max-width: 260px; object-fit: contain; }
  .header-meta { text-align: left; font-size: 11px; }
  .header-meta div { margin-bottom: 2px; }
  .header-meta b { color: #1F3A5F; }
  .party-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; }
  .party-box p { margin: 0 0 3px; }
  .tables { display: flex; gap: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; }
  th { background: #1F3A5F; color: #fff; font-weight: 600; }
  td.desc, th.desc { text-align: right; }
  .summary { display: flex; gap: 16px; margin-top: 8px; }
  .summary-box { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; font-size: 11px; }
  .summary-box.net { background: #F3E6DC; font-weight: 700; }
  .summary-box div { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .status-badge { display: inline-block; font-size: 10px; padding: 2px 10px; border-radius: 10px; background: #E3EEE7; color: #1F6B3A; }
</style>
</head>
<body>
  <div class="doc-title"><h1>فیش حقوقی — دوره‌ی ${esc(data.periodCode)}</h1></div>

  <div class="header">
    <div class="header-logo">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="logo" />` : `<b>${esc(data.ourEntity?.entityName)}</b>`}
    </div>
    <div class="header-meta">
      <div><b>وضعیت:</b> <span class="status-badge">${STATUS_LABEL[data.status] ?? data.status}</span></div>
      <div><b>آدرس:</b> ${esc(data.ourEntity?.address)}</div>
      <div><b>تلفن:</b> ${esc(data.ourEntity?.phone)} · <b>ایمیل:</b> ${esc(data.ourEntity?.email)}</div>
    </div>
  </div>

  <div class="party-box">
    <p><b>${esc(data.employeeName)}</b> (${esc(data.employeeNumber)})</p>
    <p>${esc(data.positionTitle)} — ${esc(data.departmentName)}</p>
  </div>

  <div class="tables">
    ${itemsTable(data, "earning")}
    ${itemsTable(data, "deduction")}
  </div>

  <div class="summary">
    <div class="summary-box">
      <div><span>جمع ناخالص</span><span>${money(data.grossEarnings, data.currencyCode)}</span></div>
      <div><span>جمع کسورات</span><span>${money(data.totalDeductions, data.currencyCode)}</span></div>
      <div><span>سهم بیمه کارفرما</span><span>${money(data.insuranceEmployerShare, data.currencyCode)}</span></div>
      <div><span>بیمه بیکاری (کارفرما)</span><span>${money(data.unemploymentInsurance, data.currencyCode)}</span></div>
      <div><span>هزینه‌ی تمام‌شده‌ی کارفرما</span><span>${money(data.employerCost, data.currencyCode)}</span></div>
    </div>
    <div class="summary-box net">
      <div><span>خالص پرداختی</span><span>${money(data.netSalary, data.currencyCode)}</span></div>
    </div>
  </div>
</body>
</html>`;
}
