// سازنده متن ایمیل RFQ — به انگلیسی (مخاطب: تأمین‌کننده خارجی)
// طبق design doc: جدول اقلام + امضای شرکت گروهِ ارسال‌کننده

interface EmailItem {
  itemCode: string;
  description: string;
  quantity: string | number;
  measurementUnit: string;
  partNumber?: string | null;
  builder?: string | null;
}

export interface RfqEmailInput {
  rfqNumber: string;
  subject: string;
  entityName: string;
  expertFullName: string;
  responseDueDate?: Date | null;
  items: EmailItem[];
}

export function buildRfqEmailHtml(input: RfqEmailInput): string {
  const rows = input.items
    .map(
      (item, index) => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(item.itemCode)}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(item.description)}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${item.quantity}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${escapeHtml(item.measurementUnit)}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(item.partNumber ?? "-")}</td>
        <td style="border:1px solid #ccc;padding:6px">${escapeHtml(item.builder ?? "-")}</td>
      </tr>`,
    )
    .join("");

  const dueLine = input.responseDueDate
    ? `<p>We would appreciate receiving your offer by <strong>${input.responseDueDate.toISOString().slice(0, 10)}</strong>.</p>`
    : "";

  return `
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#222" dir="ltr">
    <p>Dear Sir/Madam,</p>
    <p>Please kindly provide us with your best offer (price, delivery time and payment terms)
    for the following items — reference <strong>${escapeHtml(input.rfqNumber)}</strong>:</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="background:#f0f0f0">
          <th style="border:1px solid #ccc;padding:6px">#</th>
          <th style="border:1px solid #ccc;padding:6px">Item Code</th>
          <th style="border:1px solid #ccc;padding:6px">Description</th>
          <th style="border:1px solid #ccc;padding:6px">Qty</th>
          <th style="border:1px solid #ccc;padding:6px">Unit</th>
          <th style="border:1px solid #ccc;padding:6px">Part No.</th>
          <th style="border:1px solid #ccc;padding:6px">Manufacturer</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${dueLine}
    <p>Please also state country of origin, offer validity and technical datasheets where applicable.</p>
    <p>Best regards,<br/>
    <strong>${escapeHtml(input.expertFullName)}</strong><br/>
    ${escapeHtml(input.entityName)}</p>
  </div>`;
}

/** نسخه متنی ساده — برای کپی دستی در حالت بدون SMTP */
export function buildRfqEmailText(input: RfqEmailInput): string {
  const lines = input.items.map(
    (item, index) =>
      `${index + 1}. ${item.itemCode} | ${item.description} | ${item.quantity} ${item.measurementUnit}` +
      (item.partNumber ? ` | PN: ${item.partNumber}` : "") +
      (item.builder ? ` | ${item.builder}` : ""),
  );
  const due = input.responseDueDate
    ? `\nWe would appreciate receiving your offer by ${input.responseDueDate.toISOString().slice(0, 10)}.`
    : "";
  return (
    `Subject: ${input.subject}\n\n` +
    `Dear Sir/Madam,\n\n` +
    `Please kindly provide us with your best offer (price, delivery time and payment terms) ` +
    `for the following items — reference ${input.rfqNumber}:\n\n` +
    lines.join("\n") +
    `\n${due}\n` +
    `Please also state country of origin, offer validity and technical datasheets where applicable.\n\n` +
    `Best regards,\n${input.expertFullName}\n${input.entityName}`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
