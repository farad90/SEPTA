import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { isAxiosError } from "axios";
import { AuthLayout } from "./AuthLayout";
import { TextField } from "../../components/TextField";
import { apiClient } from "../../lib/api-client";

const DEPARTMENTS = ["فروش", "بازرگانی", "مالی", "مدیریت"] as const;

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<(typeof DEPARTMENTS)[number]>("فروش");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = fullName && mobile && email && password && !passwordsMismatch && !isSubmitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/register", { fullName, mobile, email, department, password });
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
          <h2 className="text-lg font-bold mb-2 text-textPrimary">درخواست شما ثبت شد</h2>
          <p className="text-sm mb-6 text-textSecondary">
            درخواست دسترسی برای <strong className="text-textPrimary">{fullName}</strong> برای مدیر
            ارسال شد. بعد از تأیید و تعیین گروه دسترسی، اطلاع‌رسانی می‌شه و می‌تونی وارد بشی.
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
        <h2 className="text-xl font-bold mb-1 text-textPrimary">درخواست دسترسی</h2>
        <p className="text-xs mb-6 text-textSecondary">
          بعد از ثبت، مدیر باید درخواست شما را تأیید و یک گروه دسترسی برایتان تعیین کند.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-textPrimary">نام و نام خانوادگی</label>
            <TextField icon={User} placeholder="مثلاً فرشید محمدی" value={fullName} onChange={setFullName} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-textPrimary">موبایل</label>
              <TextField icon={Phone} placeholder="09121234567" value={mobile} onChange={setMobile} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-textPrimary">واحد سازمانی</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as (typeof DEPARTMENTS)[number])}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                {DEPARTMENTS.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-textPrimary">ایمیل سازمانی</label>
            <TextField icon={Mail} placeholder="farshid@poulad-tajhiz.com" value={email} onChange={setEmail} required />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-textPrimary">رمز عبور</label>
            <TextField
              icon={Lock}
              type="password"
              placeholder="حداقل ۸ کاراکتر"
              value={password}
              onChange={setPassword}
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
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white mb-4 disabled:opacity-60"
          style={{ background: canSubmit ? "#1F3A5F" : "#6B675F" }}
        >
          {isSubmitting ? "در حال ارسال..." : "ارسال درخواست ثبت‌نام"}
        </button>

        <p className="text-xs text-center text-textSecondary">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link to="/login" className="font-medium underline text-accent">
            وارد شوید
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
