import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { isAxiosError } from "axios";
import { AuthLayout } from "./AuthLayout";
import { TextField } from "../../components/TextField";
import { apiClient } from "../../lib/api-client";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = !!token && newPassword.length >= 8 && !passwordsMismatch && !isSubmitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !token) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword });
      setSubmitted(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.message) {
        setError(String(err.response.data.message));
      } else {
        setError("تغییر رمز عبور ناموفق بود. دوباره تلاش کنید.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <h2 className="text-lg font-bold mb-2 text-textPrimary">لینک نامعتبره</h2>
          <p className="text-sm mb-6 text-textSecondary">
            این لینک بازیابی رمز عبور نامعتبره یا ناقصه. از صفحه‌ی فراموشی رمز عبور دوباره تلاش کنید.
          </p>
          <Link to="/forgot-password" className="flex items-center gap-1.5 justify-center text-sm font-medium text-primary">
            درخواست لینک جدید <ArrowRight size={14} />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (submitted) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-successSoft text-success">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="text-lg font-bold mb-2 text-textPrimary">رمز عبور تغییر کرد</h2>
          <p className="text-sm mb-6 text-textSecondary">
            رمز عبورتون با موفقیت تغییر کرد. حالا می‌تونید با رمز جدید وارد بشید.
          </p>
          <Link to="/login" className="flex items-center gap-1.5 justify-center text-sm font-medium text-primary">
            ورود به سامانه <ArrowRight size={14} />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-1 text-textPrimary">تعیین رمز عبور جدید</h2>
        <p className="text-xs mb-6 text-textSecondary">یک رمز عبور جدید برای حساب کاربری‌تون انتخاب کنید.</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-textPrimary">رمز عبور جدید</label>
            <TextField
              icon={Lock}
              type="password"
              placeholder="حداقل ۸ کاراکتر"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-textPrimary">تکرار رمز عبور</label>
            <TextField
              icon={Lock}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              required
            />
            {passwordsMismatch && (
              <p className="text-[11px] mt-1 text-danger">رمز عبور و تکرار آن یکسان نیستند</p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs mb-4 rounded-lg bg-danger/10 px-3 py-2 text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white mb-4 bg-primary disabled:opacity-60"
        >
          {isSubmitting ? "در حال ثبت..." : "تغییر رمز عبور"}
        </button>

        <p className="text-xs text-center text-textSecondary">
          <Link to="/login" className="font-medium underline text-accent">
            بازگشت به صفحه ورود
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
