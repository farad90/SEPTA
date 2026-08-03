import React, { useState } from "react";
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Building2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

const tokens = {
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  primary: "#1F3A5F",
  primaryDark: "#16293F",
  accent: "#A9633B",
  accentSoft: "#F3E6DC",
  border: "#E3DED2",
  textPrimary: "#20201C",
  textSecondary: "#6B675F",
  danger: "#B3413A",
  success: "#2F7D5D",
  successSoft: "#E4F0EA",
};

const inputStyle = { border: `1px solid ${tokens.border}` };
const label = "block text-xs font-medium mb-1.5";

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between w-[42%] p-10 relative overflow-hidden"
      style={{ background: tokens.primaryDark }}
    >
      {/* الگوی ظریف پس‌زمینه — یادآور پلاک/مهر صنعتی */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)`,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-16">
          <div className="w-12 h-12 rounded-md flex items-center justify-center shrink-0" style={{ background: "#fff" }}>
            <img src="./assets/SEPTA_LOGO.png" alt="سپتا" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <p className="text-base font-bold text-white">سپتا</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>سامانه یکپارچه پولاد تجهیز آپادانا</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white leading-relaxed mb-3">
          از استعلام تا تسویه،
          <br />
          همه‌چیز یک‌جا.
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
          مدیریت استعلام‌ها، تأمین‌کنندگان، حمل و گمرک، و مکاتبات — برای تیم فروش، بازرگانی و
          مالی، در یک سامانه.
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-3 rounded-lg p-4" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="w-9 h-9 rounded flex items-center justify-center shrink-0" style={{ background: "#fff" }}>
          <img src="./assets/PTA_logo.png" alt="پولاد تجهیز آپادانا" className="w-7 h-7 object-contain" />
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
          پولاد تجهیز آپادانا · نسخه ۲ سامانه سپتا
        </p>
      </div>
    </div>
  );
}

function TextField({ icon: Icon, type = "text", placeholder, value, onChange, endAdornment }) {
  return (
    <div className="relative">
      <Icon size={16} className="absolute top-3 right-3" style={{ color: tokens.textSecondary }} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md pr-10 py-2.5 text-sm"
        style={{ ...inputStyle, paddingLeft: endAdornment ? "2.5rem" : "0.75rem" }}
      />
      {endAdornment}
    </div>
  );
}

function LoginPage({ onSwitch }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-xl font-bold mb-1" style={{ color: tokens.textPrimary }}>ورود به سامانه</h2>
      <p className="text-xs mb-6" style={{ color: tokens.textSecondary }}>با موبایل یا ایمیل سازمانی خود وارد شوید</p>

      <div className="space-y-3 mb-4">
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>موبایل یا ایمیل</label>
          <TextField icon={Mail} placeholder="مثلاً farshid@poulad-tajhiz.com" value={identifier} onChange={setIdentifier} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: tokens.textPrimary }}>رمز عبور</label>
            <button className="text-[11px] underline" style={{ color: tokens.primary }}>فراموشی رمز عبور؟</button>
          </div>
          <TextField
            icon={Lock}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-2.5 left-3"
                style={{ color: tokens.textSecondary }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs mb-5 cursor-pointer" style={{ color: tokens.textSecondary }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-3.5 h-3.5" />
        مرا به خاطر بسپار
      </label>

      <button
        type="button"
        className="w-full py-2.5 rounded-md text-sm font-medium text-white mb-4"
        style={{ background: tokens.primary }}
      >
        ورود
      </button>

      <p className="text-xs text-center" style={{ color: tokens.textSecondary }}>
        حساب کاربری ندارید؟{" "}
        <button onClick={onSwitch} className="font-medium underline" style={{ color: tokens.accent }}>
          درخواست دسترسی بدهید
        </button>
      </p>
    </div>
  );
}

function RegisterPage({ onSwitch }) {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("فروش");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = fullName && mobile && email && password && !passwordsMismatch;

  if (submitted) {
    return (
      <div className="w-full max-w-sm text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: tokens.successSoft, color: tokens.success }}
        >
          <CheckCircle2 size={26} />
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: tokens.textPrimary }}>درخواست شما ثبت شد</h2>
        <p className="text-sm mb-6" style={{ color: tokens.textSecondary }}>
          درخواست دسترسی برای <strong style={{ color: tokens.textPrimary }}>{fullName}</strong> برای
          مدیر ارسال شد. بعد از تأیید و تعیین گروه دسترسی، اطلاع‌رسانی می‌شه و می‌تونی وارد بشی.
        </p>
        <button onClick={onSwitch} className="flex items-center gap-1.5 mx-auto text-sm font-medium" style={{ color: tokens.primary }}>
          بازگشت به صفحه ورود <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-xl font-bold mb-1" style={{ color: tokens.textPrimary }}>درخواست دسترسی</h2>
      <p className="text-xs mb-6" style={{ color: tokens.textSecondary }}>
        بعد از ثبت، مدیر باید درخواست شما را تأیید و یک گروه دسترسی برایتان تعیین کند.
      </p>

      <div className="space-y-3 mb-4">
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>نام و نام خانوادگی</label>
          <TextField icon={User} placeholder="مثلاً فرشید محمدی" value={fullName} onChange={setFullName} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} style={{ color: tokens.textPrimary }}>موبایل</label>
            <TextField icon={Phone} placeholder="0912-1234567" value={mobile} onChange={setMobile} />
          </div>
          <div>
            <label className={label} style={{ color: tokens.textPrimary }}>واحد سازمانی</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-md px-3 py-2.5 text-sm"
              style={inputStyle}
            >
              <option>فروش</option>
              <option>بازرگانی</option>
              <option>مالی</option>
              <option>مدیریت</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>ایمیل سازمانی</label>
          <TextField icon={Mail} placeholder="farshid@poulad-tajhiz.com" value={email} onChange={setEmail} />
        </div>
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>رمز عبور</label>
          <TextField icon={Lock} type="password" placeholder="حداقل ۸ کاراکتر" value={password} onChange={setPassword} />
        </div>
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>تکرار رمز عبور</label>
          <TextField icon={Lock} type="password" placeholder="••••••••" value={confirmPassword} onChange={setConfirmPassword} />
          {passwordsMismatch && (
            <p className="text-[11px] mt-1" style={{ color: tokens.danger }}>رمز عبور و تکرار آن یکسان نیستند</p>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => setSubmitted(true)}
        className="w-full py-2.5 rounded-md text-sm font-medium text-white mb-4"
        style={{ background: canSubmit ? tokens.primary : tokens.textSecondary, opacity: canSubmit ? 1 : 0.6 }}
      >
        ارسال درخواست ثبت‌نام
      </button>

      <p className="text-xs text-center" style={{ color: tokens.textSecondary }}>
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <button onClick={onSwitch} className="font-medium underline" style={{ color: tokens.accent }}>
          وارد شوید
        </button>
      </p>
    </div>
  );
}

export default function AuthPagesMockup() {
  const [view, setView] = useState("login");

  return (
    <div dir="rtl" style={{ fontFamily: "Vazirmatn, sans-serif" }} className="flex min-h-screen">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>

      <BrandPanel />

      <div className="flex-1 flex items-center justify-center p-6" style={{ background: tokens.bg }}>
        {view === "login" ? (
          <LoginPage onSwitch={() => setView("register")} />
        ) : (
          <RegisterPage onSwitch={() => setView("login")} />
        )}
      </div>
    </div>
  );
}
