import React, { useState } from "react";
import { TrendingUp, TrendingDown, Award, XCircle, Users, Package } from "lucide-react";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

const tokens = {
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  primary: "#1F3A5F",
  accent: "#A9633B",
  accentSoft: "#F3E6DC",
  border: "#E3DED2",
  textPrimary: "#20201C",
  textSecondary: "#6B675F",
  danger: "#B3413A",
  success: "#2F7D5D",
  successSoft: "#E4F0EA",
  warning: "#B98900",
  warningSoft: "#FBF2DA",
};
const inputStyle = { border: `1px solid ${tokens.border}` };

const LOSS_REASONS = [
  { reason: "قیمت بالاتر از رقیب", count: 14, value: 128000 },
  { reason: "زمان تحویل نامناسب", count: 8, value: 61000 },
  { reason: "عدم تطابق فنی", count: 5, value: 33000 },
  { reason: "تغییر نیاز مشتری", count: 4, value: 18500 },
  { reason: "سایر", count: 3, value: 9000 },
];

const COMPETITORS = [
  { name: "شرکت الف صنعت", wins: 9, avgPriceDiff: "+۱۲٪" },
  { name: "پارس تجهیز کاران", wins: 6, avgPriceDiff: "+۷٪" },
  { name: "نامشخص", wins: 5, avgPriceDiff: "—" },
  { name: "توسعه صنایع البرز", wins: 4, avgPriceDiff: "+۱۵٪" },
];

const EXPERT_PERFORMANCE = [
  { name: "فرشید محمدی", won: 12, lost: 4, rate: 75 },
  { name: "علی محمدی", won: 6, lost: 8, rate: 43 },
  { name: "سارا کریمی", won: 9, lost: 3, rate: 75 },
  { name: "حسین رستمی", won: 3, lost: 2, rate: 60 },
];

const TOP_LOST_ITEMS = [
  { code: "BRG-6202-2RS", desc: "بلبرینگ ساچمه‌ای شیار عمیق 6202", lostCount: 6 },
  { code: "SEAL-NBR-45", desc: "کاسه‌نمد لاستیکی NBR سایز 45", lostCount: 4 },
  { code: "BLT-M12-80", desc: "پیچ آلن سرخود M12x80", lostCount: 3 },
];

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${color}22`, color }}>
          <Icon size={16} />
        </div>
        <p className="text-xs" style={{ color: tokens.textSecondary }}>{label}</p>
      </div>
      <p className="text-xl font-bold" style={{ color: tokens.textPrimary }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: tokens.textSecondary }}>{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, max, value, color }) {
  const pct = (count / max) * 100;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1 text-xs">
        <span style={{ color: tokens.textPrimary }}>{label}</span>
        <span className="mono" style={{ color: tokens.textSecondary }}>
          {count} مورد {value && `· ${value.toLocaleString("en-US")} EUR`}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: tokens.bg }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function WinLossReportMockup() {
  const [period, setPeriod] = useState("last90");

  const totalWon = 30, totalLost = 17, totalCancelled = 5;
  const totalDecided = totalWon + totalLost;
  const winRate = Math.round((totalWon / totalDecided) * 100);
  const maxLossReason = Math.max(...LOSS_REASONS.map((l) => l.count));
  const maxExpertTotal = Math.max(...EXPERT_PERFORMANCE.map((e) => e.won + e.lost));

  return (
    <div dir="rtl" style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="p-4 sm:p-8">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>گزارش تحلیل برد و باخت</h1>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
            <option value="last30">۳۰ روز اخیر</option>
            <option value="last90">۹۰ روز اخیر</option>
            <option value="year">سال جاری</option>
            <option value="all">کل بازه</option>
          </select>
        </div>
        <p className="text-xs mb-5" style={{ color: tokens.textSecondary }}>
          تحلیل در سطح هر قلم استعلام (نه کل استعلام) — چون یک پرونده می‌تونه هم برد هم باخت داشته باشه.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KpiCard icon={Award} label="نرخ برد" value={`${winRate}٪`} sub={`${totalWon} از ${totalDecided} قلم تصمیم‌گرفته‌شده`} color={tokens.success} />
          <KpiCard icon={TrendingUp} label="اقلام برنده" value={totalWon} color={tokens.success} />
          <KpiCard icon={TrendingDown} label="اقلام بازنده" value={totalLost} color={tokens.danger} />
          <KpiCard icon={XCircle} label="لغو شده" value={totalCancelled} color={tokens.textSecondary} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* دلایل باخت */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>مهم‌ترین دلایل باخت</p>
            {LOSS_REASONS.map((l) => (
              <BarRow key={l.reason} label={l.reason} count={l.count} max={maxLossReason} value={l.value} color={tokens.danger} />
            ))}
          </div>

          {/* رقبا */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} style={{ color: tokens.accent }} />
              <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>رقبایی که بیشترین برد رو از ما گرفتن</p>
            </div>
            <div className="space-y-2">
              {COMPETITORS.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs rounded-md px-3 py-2" style={{ background: tokens.bg }}>
                  <span style={{ color: tokens.textPrimary }}>{c.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="mono" style={{ color: tokens.textSecondary }}>{c.wins} برد</span>
                    <span className="mono px-2 py-0.5 rounded-full" style={{ background: tokens.warningSoft, color: tokens.warning }}>
                      اختلاف قیمت: {c.avgPriceDiff}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* عملکرد کارشناسان فروش */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>نرخ برد به تفکیک کارشناس فروش</p>
            {EXPERT_PERFORMANCE.map((e) => (
              <div key={e.name} className="mb-2.5">
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span style={{ color: tokens.textPrimary }}>{e.name}</span>
                  <span className="mono" style={{ color: tokens.textSecondary }}>{e.won} برد / {e.lost} باخت · {e.rate}٪</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex" style={{ background: tokens.bg }}>
                  <div className="h-full" style={{ width: `${(e.won / maxExpertTotal) * 100}%`, background: tokens.success }} />
                  <div className="h-full" style={{ width: `${(e.lost / maxExpertTotal) * 100}%`, background: tokens.danger }} />
                </div>
              </div>
            ))}
          </div>

          {/* پرتکرارترین اقلام بازنده */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Package size={15} style={{ color: tokens.accent }} />
              <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>پرتکرارترین اقلام بازنده</p>
            </div>
            <div className="space-y-1.5">
              {TOP_LOST_ITEMS.map((it) => (
                <div key={it.code} className="flex items-center gap-2 text-xs rounded-md px-3 py-2" style={{ background: tokens.bg }}>
                  <span className="mono" style={{ color: tokens.textSecondary }}>{it.code}</span>
                  <span className="flex-1" style={{ color: tokens.textPrimary }}>{it.desc}</span>
                  <span className="mono px-2 py-0.5 rounded-full" style={{ background: "#F3E6E4", color: tokens.danger }}>
                    {it.lostCount} بار باخت
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-3" style={{ color: tokens.textSecondary }}>
              پیشنهاد: بررسی این اقلام برای یافتن تأمین‌کننده رقابتی‌تر یا معادل جایگزین.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" className="text-xs px-4 py-2 rounded-md" style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}>
            خروجی Excel این گزارش
          </button>
        </div>
      </div>
    </div>
  );
}
