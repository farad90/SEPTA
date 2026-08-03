import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { isAxiosError } from "axios";
import { AuthLayout } from "./AuthLayout";
import { TextField } from "../../components/TextField";
import { apiClient } from "../../lib/api-client";

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/forgot-password", { identifier });
      // پیام همیشه یکسانه (چه کاربر پیدا بشه چه نه) — جلوگیری از لو رفتن این‌که کدوم ایمیل ثبت‌شده
      setSubmitted(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.message) {
        setError(String(err.response.data.message));
      } else {
        setError("ثبت درخواست ناموفق بود. دوباره تلاش کنید.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-successSoft text-success">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="text-lg font-bold mb-2 text-textPrimary">درخواست ثبت شد</h2>
          <p className="text-sm mb-6 text-textSecondary">
            اگر «{identifier}» در سامانه ثبت شده باشه، لینک بازیابی رمز عبور براش ارسال می‌شه. ایمیل خودتون رو
            بررسی کنید.
          </p>
          <Link to="/login" className="flex items-center gap-1.5 justify-center text-sm font-medium text-primary">
            بازگشت به صفحه ورود <ArrowRight size={14} />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-1 text-textPrimary">فراموشی رمز عبور</h2>
        <p className="text-xs mb-6 text-textSecondary">
          موبایل یا ایمیل سازمانی خودتون رو وارد کنید تا لینک بازیابی رمز عبور براتون ارسال بشه.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5 text-textPrimary">موبایل یا ایمیل</label>
          <TextField
            icon={Mail}
            placeholder="مثلاً farshid@poulad-tajhiz.com"
            value={identifier}
            onChange={setIdentifier}
            autoComplete="username"
            required
          />
        </div>

        {error && (
          <p className="text-xs mb-4 rounded-lg bg-danger/10 px-3 py-2 text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !identifier.trim()}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white mb-4 bg-primary disabled:opacity-60"
        >
          {isSubmitting ? "در حال ارسال..." : "ارسال لینک بازیابی"}
        </button>

        <p className="text-xs text-center text-textSecondary">
          رمز عبورتون رو به خاطر آوردید؟{" "}
          <Link to="/login" className="font-medium underline text-accent">
            بازگشت به ورود
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
