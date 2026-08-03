import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { isAxiosError } from "axios";
import { AuthLayout } from "./AuthLayout";
import { TextField } from "../../components/TextField";
import { useAuth } from "../../lib/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.message) {
        setError(String(err.response.data.message));
      } else {
        setError("ورود ناموفق بود. دوباره تلاش کنید.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-1 text-textPrimary">ورود به سامانه</h2>
        <p className="text-xs mb-6 text-textSecondary">با موبایل یا ایمیل سازمانی خود وارد شوید</p>

        <div className="space-y-3 mb-4">
          <div>
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-textPrimary">رمز عبور</label>
              <Link to="/forgot-password" className="text-[11px] underline text-primary">
                فراموشی رمز عبور؟
              </Link>
            </div>
            <TextField
              icon={Lock}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-2.5 left-3 text-textSecondary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>
        </div>

        {error && (
          <p className="text-xs mb-4 rounded-lg bg-danger/10 px-3 py-2 text-danger">{error}</p>
        )}

        <label className="flex items-center gap-2 text-xs mb-5 cursor-pointer text-textSecondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          مرا به خاطر بسپار
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white mb-4 bg-primary disabled:opacity-60"
        >
          {isSubmitting ? "در حال ورود..." : "ورود"}
        </button>

        <p className="text-xs text-center text-textSecondary">
          حساب کاربری ندارید؟{" "}
          <Link to="/register" className="font-medium underline text-accent">
            درخواست دسترسی بدهید
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
