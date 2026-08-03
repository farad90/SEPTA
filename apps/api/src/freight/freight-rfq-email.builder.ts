// سازنده متن ایمیل استعلام حمل — دوزبانه (فارسی سپس انگلیسی) — فاز ۲۶
// چون مخاطب (شرکت حمل) می‌تونه داخلی یا خارجی باشه، هر دو بلوک با محتوای معادل در یک ایمیل قرار می‌گیرن
// طبق mockup: جدول بسته‌ها (ابعاد/وزن/محل بارگیری) + گمرک مقصد + امضای کارشناس بازرگانی

interface EmailPackage {
  packageNumber: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg: number;
  pickupLocation: string;
  poNumber: string;
}

export interface FreightRfqEmailInput {
  rfqNumber: string;
  subject: string;
  expertFullName: string;
  destinationCustoms: string;
  packages: EmailPackage[];
}

export function buildFreightRfqEmailHtml(input: FreightRfqEmailInput): string {
  const faRows = input.packages
    .map(
      (pkg, index) => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(pkg.packageNumber)}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(pkg.poNumber)}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${dims(pkg)}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${pkg.weightKg}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(pkg.pickupLocation)}</td>
      </tr>`,
    )
    .join("");
  const enRows = faRows; // ساختار جدول یکسانه، فقط هدر ستون‌ها فرق می‌کنه

  return `
  <div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#222" dir="rtl">
    <p>با سلام و احترام،</p>
    <p>لطفاً بهترین پیشنهاد قیمت، ارز، زمان حمل و اعتبار پیشنهاد رو برای بسته‌های زیر جهت تحویل به
    <strong>${escapeHtml(input.destinationCustoms)}</strong> — با شماره مرجع
    <strong>${escapeHtml(input.rfqNumber)}</strong> — ارائه بدید:</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px" dir="rtl">
      <thead>
        <tr style="background:#f0f0f0">
          <th style="border:1px solid #ccc;padding:6px">ردیف</th>
          <th style="border:1px solid #ccc;padding:6px">شماره بسته</th>
          <th style="border:1px solid #ccc;padding:6px">شماره سفارش خرید</th>
          <th style="border:1px solid #ccc;padding:6px">ابعاد (سانتی‌متر)</th>
          <th style="border:1px solid #ccc;padding:6px">وزن (کیلوگرم)</th>
          <th style="border:1px solid #ccc;padding:6px">محل بارگیری</th>
        </tr>
      </thead>
      <tbody>${faRows}</tbody>
    </table>
    <p>با احترام،<br/>
    <strong>${escapeHtml(input.expertFullName)}</strong></p>
  </div>
  <hr style="margin:24px 0;border:none;border-top:1px solid #ddd"/>
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#222" dir="ltr">
    <p>Dear Sir/Madam,</p>
    <p>Please kindly provide us with your best freight quotation (price, currency, transit time and
    offer validity) for the following packages to be delivered to <strong>${escapeHtml(input.destinationCustoms)}</strong>
    — reference <strong>${escapeHtml(input.rfqNumber)}</strong>:</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="background:#f0f0f0">
          <th style="border:1px solid #ccc;padding:6px">#</th>
          <th style="border:1px solid #ccc;padding:6px">Package No.</th>
          <th style="border:1px solid #ccc;padding:6px">PO No.</th>
          <th style="border:1px solid #ccc;padding:6px">Dimensions (cm)</th>
          <th style="border:1px solid #ccc;padding:6px">Weight (kg)</th>
          <th style="border:1px solid #ccc;padding:6px">Pickup Location</th>
        </tr>
      </thead>
      <tbody>${enRows}</tbody>
    </table>
    <p>Best regards,<br/>
    <strong>${escapeHtml(input.expertFullName)}</strong></p>
  </div>`;
}

/** نسخه متنی ساده — برای کپی دستی در حالت بدون SMTP */
export function buildFreightRfqEmailText(input: FreightRfqEmailInput): string {
  const lines = input.packages.map(
    (pkg, index) =>
      `${index + 1}. ${pkg.packageNumber} (PO ${pkg.poNumber}) | ${dims(pkg)} cm | ${pkg.weightKg} kg | ${pkg.pickupLocation}`,
  );
  const faBody =
    `با سلام و احترام،\n\n` +
    `لطفاً بهترین پیشنهاد قیمت، ارز، زمان حمل و اعتبار پیشنهاد رو برای بسته‌های زیر جهت تحویل به ` +
    `${input.destinationCustoms} — با شماره مرجع ${input.rfqNumber} — ارائه بدید:\n\n` +
    lines.join("\n") +
    `\n\nبا احترام،\n${input.expertFullName}`;
  const enBody =
    `Dear Sir/Madam,\n\n` +
    `Please kindly provide us with your best freight quotation (price, currency, transit time and ` +
    `offer validity) for the following packages to be delivered to ${input.destinationCustoms} ` +
    `— reference ${input.rfqNumber}:\n\n` +
    lines.join("\n") +
    `\n\nBest regards,\n${input.expertFullName}`;

  return `Subject: ${input.subject}\n\n${faBody}\n\n------------------------------\n\n${enBody}`;
}

function dims(pkg: EmailPackage): string {
  if (pkg.lengthCm == null || pkg.widthCm == null || pkg.heightCm == null) return "-";
  return `${pkg.lengthCm}×${pkg.widthCm}×${pkg.heightCm}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
