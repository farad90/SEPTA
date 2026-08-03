import { useState } from "react";
import type { ReactNode } from "react";
import { API_URL } from "../../lib/api-client";

function BrandPanel() {
  const [hasBackground, setHasBackground] = useState(true);

  return (
    <div className="hidden lg:flex flex-col justify-between w-[42%] p-10 relative overflow-hidden bg-primaryDark">
      {hasBackground && (
        <>
          <img
            src={`${API_URL}/public/login-background`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setHasBackground(false)}
          />
          {/* گرادیان تیره روی تصویر پس‌زمینه برای خوانایی متن سفید روش */}
          <div className="absolute inset-0 bg-gradient-to-b from-primaryDark/80 via-primaryDark/60 to-primaryDark/90" />
        </>
      )}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)",
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-16">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-white">
            <img src="/assets/SEPTA_LOGO.png" alt="سپتا" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <p className="text-base font-bold text-white">سپتا</p>
            <p className="text-[11px] text-white/55">سامانه یکپارچه پولاد تجهیز آپادانا</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white leading-relaxed mb-3">
          از استعلام تا تسویه،
          <br />
          همه‌چیز یک‌جا.
        </h1>
        <p className="text-sm leading-relaxed text-white/65">
          مدیریت استعلام‌ها، تأمین‌کنندگان، حمل و گمرک، و مکاتبات — برای تیم فروش، بازرگانی و
          مالی، در یک سامانه.
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-3 rounded-lg p-4 bg-white/[0.06]">
        <div className="w-9 h-9 rounded flex items-center justify-center shrink-0 bg-white">
          <img src="/assets/PTA_logo.png" alt="پولاد تجهیز آپادانا" className="w-7 h-7 object-contain" />
        </div>
        <p className="text-[11px] text-white/55">پولاد تجهیز آپادانا · نسخه ۲ سامانه سپتا</p>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="flex min-h-screen font-vazir">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6 bg-bg">{children}</div>
    </div>
  );
}
