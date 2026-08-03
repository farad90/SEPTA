// سازنده متن ایمیل بازیابی رمز عبور — فارسی/RTL (مخاطب: کاربر داخلی سامانه)

export interface PasswordResetEmailInput {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function buildPasswordResetEmailHtml(input: PasswordResetEmailInput): string {
  return `
  <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#222">
    <p>${escapeHtml(input.fullName)} عزیز،</p>
    <p>درخواست بازیابی رمز عبور برای حساب شما در سامانه سپتا ثبت شد. برای تعیین رمز عبور جدید روی دکمه زیر کلیک کنید:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${input.resetUrl}" style="background:#1F3A5F;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;display:inline-block">تعیین رمز عبور جدید</a>
    </p>
    <p style="color:#666;font-size:12px">این لینک تا ${input.expiresInMinutes} دقیقه دیگر معتبره. اگر این درخواست را شما ثبت نکرده‌اید، این ایمیل را نادیده بگیرید — رمز عبور شما تغییری نمی‌کنه.</p>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
