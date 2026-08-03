import React, { useState } from "react";
import {
  Bell,
  Clock,
  TrendingUp,
  TrendingDown,
  Package,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Users,
  DollarSign,
  Truck,
  Mail,
  Coins,
  Plus,
  Check,
} from "lucide-react";

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

function Avatar({ name, size = 24 }) {
  const colors = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white" style={{ width: size, height: size, background: colors[Math.abs(hash) % colors.length], fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${color}22`, color }}>
          <Icon size={16} />
        </div>
        {trend && (
          <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: trend > 0 ? tokens.success : tokens.danger }}>
            {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {Math.abs(trend)}٪
          </span>
        )}
      </div>
      <p className="text-xl font-bold" style={{ color: tokens.textPrimary }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: tokens.textSecondary }}>{label}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: tokens.textSecondary }}>{sub}</p>}
    </div>
  );
}

const ACTION_ITEMS = {
  expert: [
    { icon: Clock, text: "RFQ-1044 به Bulten Fasteners بیش از ۳ روزه بدون پاسخه", link: "INQ-2026-0512", color: tokens.warning },
    { icon: FileText, text: "پیشنهاد INQ-2026-0388 هنوز به مرحله ارسال نرسیده", link: "INQ-2026-0388", color: tokens.accent },
    { icon: Mail, text: "نامه ۱۴۰۵-پ ت-۰۰۴۱ نیاز به پاسخ تا فردا داره", link: "letter-41", color: tokens.danger },
    { icon: Bell, text: "علی محمدی شما را در استعلام INQ-2026-0417 منشن کرد", link: "INQ-2026-0417", color: tokens.primary },
  ],
  manager: [
    { icon: CheckCircle2, text: "۲ استعلام منتظر قفل نهایی قیمت‌گذاری هستن", link: "#", color: tokens.accent },
    { icon: DollarSign, text: "تخفیف ۸٪ روی INQ-2026-0512 نیاز به تأیید مدیر داره", link: "INQ-2026-0512", color: tokens.warning },
    { icon: Truck, text: "محموله SHP-2026-014 در حال حمله، ETA ۴ روز دیگر", link: "#", color: tokens.primary },
    { icon: AlertTriangle, text: "۳ فاکتور بیش از ۳۰ روز معوق مانده", link: "#", color: tokens.danger },
  ],
};

const RECENT_ACTIVITY = [
  { author: "علی محمدی", text: "فایل‌های پیشنهاد INQ-2026-0417 را برای مشتری ارسال کرد", time: "۲ ساعت پیش" },
  { author: "حسین رستمی", text: "پیشنهاد قیمت Schaeffler Group را در INQ-2026-0417 ثبت کرد", time: "۵ ساعت پیش" },
  { author: "سارا کریمی", text: "نتیجه «برد» را برای INQ-2026-0301 ثبت کرد", time: "دیروز" },
  { author: "فرشید محمدی", text: "انتخاب نهایی و قیمت‌گذاری INQ-2026-0417 را قفل کرد", time: "دیروز" },
  { author: "مریم صادقی", text: "فاکتور INV-0398 را صادر کرد", time: "۲ روز پیش" },
];

const STATUS_DIST = [
  { label: "در جریان", count: 18, color: tokens.warning },
  { label: "برد کامل", count: 30, color: tokens.success },
  { label: "برد جزئی", count: 6, color: tokens.accent },
  { label: "باخت کامل", count: 17, color: tokens.danger },
  { label: "لغو/معلق", count: 8, color: tokens.textSecondary },
];

const TEAM_PERFORMANCE = [
  { name: "فرشید محمدی", active: 5, winRate: 75, value: 210000 },
  { name: "علی محمدی", active: 3, winRate: 43, value: 95000 },
  { name: "سارا کریمی", active: 4, winRate: 75, value: 142000 },
  { name: "حسین رستمی", active: 2, winRate: 60, value: 38000 },
];

const GOLD_CURRENCY_DATA = [
  { label: "دلار / سامانه معاملات طلا و ارز (خرید)", value: "۶۸,۴۵۰", unit: "ریال", change: 0.6 },
  { label: "دلار / سامانه معاملات طلا و ارز (فروش)", value: "۶۸,۹۲۰", unit: "ریال", change: 0.6 },
  { label: "یورو / سامانه معاملات طلا و ارز", value: "۷۴,۱۰۰", unit: "ریال", change: -0.3 },
  { label: "یورو به دلار", value: "۱.۰۸۲", unit: "", change: 0.2 },
  { label: "دلار به درهم", value: "۳.۶۷۳", unit: "", change: 0.0 },
  { label: "یورو به زلوتی", value: "۴.۲۸", unit: "", change: -0.4 },
  { label: "دلار به یوان", value: "۷.۱۴", unit: "", change: 0.1 },
  { label: "طلای جهانی (اونس)", value: "۲,۳۸۰", unit: "USD", change: 1.1 },
  { label: "طلای ۱۸ عیار (هر گرم، ایران)", value: "۴۱,۲۰۰,۰۰۰", unit: "ریال", change: 0.9 },
];

function GoldCurrencyWidget() {
  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Coins size={15} style={{ color: tokens.accent }} />
        <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>نرخ لحظه‌ای ارز و طلا</p>
        <span className="text-[10px] mr-auto" style={{ color: tokens.textSecondary }}>به‌روزرسانی: چند دقیقه پیش</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {GOLD_CURRENCY_DATA.map((d) => (
          <div key={d.label} className="rounded-md p-2.5" style={{ background: tokens.bg }}>
            <p className="text-[11px] mb-1" style={{ color: tokens.textSecondary }}>{d.label}</p>
            <div className="flex items-end justify-between">
              <p className="mono text-sm font-bold" style={{ color: tokens.textPrimary }}>
                {d.value} <span className="text-[10px] font-normal">{d.unit}</span>
              </p>
              <span
                className="text-[10px] font-medium flex items-center gap-0.5"
                style={{ color: d.change > 0 ? tokens.success : d.change < 0 ? tokens.danger : tokens.textSecondary }}
              >
                {d.change > 0 ? <TrendingUp size={10} /> : d.change < 0 ? <TrendingDown size={10} /> : null}
                {d.change !== 0 ? `${Math.abs(d.change)}٪` : "بدون تغییر"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] mt-2" style={{ color: tokens.textSecondary }}>
        نرخ‌ها از سامانه معاملات طلا و ارز و منابع بین‌المللی دریافت می‌شوند و صرفاً جهت اطلاع است.
      </p>
    </div>
  );
}

function TodoWidget() {
  const [todos, setTodos] = useState([
    { id: 1, text: "پیگیری تلفنی با فولاد مبارکه درباره INQ-2026-0417", due: "امروز ۱۶:۰۰", by: "خودم", done: false },
    { id: 2, text: "بررسی و تأیید قیمت‌گذاری استعلام BLT-9002", due: "فردا", by: "مدیر (فرشید محمدی)", done: false },
    { id: 3, text: "ارسال مدارک ثبت سفارش برای SHP-2026-014", due: "دیروز", by: "خودم", done: true },
  ]);
  const [newTodo, setNewTodo] = useState("");

  const toggle = (id) => setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const add = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo, due: "تعیین‌نشده", by: "خودم", done: false }]);
    setNewTodo("");
  };

  return (
    <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>یادآورها و کارهای من (TODO)</p>
      <div className="space-y-2 mb-3">
        {todos.map((t) => (
          <label key={t.id} className="flex items-start gap-2.5 rounded-md px-3 py-2.5 cursor-pointer" style={{ background: t.done ? tokens.successSoft : tokens.bg }}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} className="w-3.5 h-3.5 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs" style={{ color: t.done ? tokens.textSecondary : tokens.textPrimary, textDecoration: t.done ? "line-through" : "none" }}>
                {t.text}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: tokens.textSecondary }}>
                مهلت: {t.due} · نوشته‌شده توسط: {t.by}
              </p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="یادآور جدید برای خودم..."
          className="flex-1 text-xs rounded-md px-3 py-2"
          style={{ border: `1px solid ${tokens.border}` }}
        />
        <button onClick={add} className="flex items-center gap-1 text-xs px-3 py-2 rounded-md text-white" style={{ background: tokens.primary }}>
          <Plus size={13} /> افزودن
        </button>
      </div>
    </div>
  );
}

export default function DashboardMockup() {
  const [role, setRole] = useState("expert"); // expert | manager

  const totalStatus = STATUS_DIST.reduce((s, x) => s + x.count, 0);

  return (
    <div dir="rtl" style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="p-4 sm:p-8">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div>
            <p className="text-xs" style={{ color: tokens.textSecondary }}>سلام فرشید،</p>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>
              {role === "expert" ? "داشبورد کارشناس" : "داشبورد مدیریتی"}
            </h1>
          </div>
          <div className="flex gap-1 rounded-full p-1" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <button onClick={() => setRole("expert")} className="text-xs px-3 py-1.5 rounded-full" style={{ background: role === "expert" ? tokens.primary : "transparent", color: role === "expert" ? "#fff" : tokens.textSecondary }}>
              نمای کارشناس
            </button>
            <button onClick={() => setRole("manager")} className="text-xs px-3 py-1.5 rounded-full" style={{ background: role === "manager" ? tokens.primary : "transparent", color: role === "manager" ? "#fff" : tokens.textSecondary }}>
              نمای مدیریتی
            </button>
          </div>
        </div>
        <p className="text-xs mb-5" style={{ color: tokens.textSecondary }}>امروز، ۱۴۰۵/۰۴/۱۶</p>

        {/* KPI ها — طبق مشخصات دقیق */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {role === "expert" ? (
            <>
              <KpiCard icon={FileText} label="نرخ استعلام‌های پیشنهاددهی‌شده" value="۷۸٪" sub="از کل استعلام‌های من" color={tokens.primary} />
              <KpiCard icon={TrendingUp} label="نرخ تبدیل پیشنهاد به سفارش" value="۶۴٪" trend={5} color={tokens.success} />
              <KpiCard icon={DollarSign} label="ارزش سفارش‌های در جریان من" value="۲۱۰K€" color={tokens.accent} />
              <KpiCard icon={Clock} label="منتظر بازگشایی مناقصه" value="۴ مورد" sub="ارزش: ۹۶K€" color={tokens.warning} />
              <KpiCard icon={Package} label="تحویل‌شده، منتظر تأیید فنی مشتری" value="۲ سفارش" sub="۴۵K€ — قبل از صدور فاکتور" color={tokens.accent} />
              <KpiCard icon={AlertTriangle} label="فاکتورهای منتظر پرداخت" value="۳ فاکتور" sub="۶۲K€" color={tokens.danger} />
            </>
          ) : (
            <>
              <KpiCard icon={FileText} label="نرخ استعلام‌های پیشنهاددهی‌شده (تیم)" value="۷۱٪" color={tokens.primary} />
              <KpiCard icon={TrendingUp} label="نرخ تبدیل پیشنهاد به سفارش (تیم)" value="۵۸٪" trend={-2} color={tokens.success} />
              <KpiCard icon={DollarSign} label="کل ارزش سفارش‌های در جریان" value="۴۸۵K€" color={tokens.accent} />
              <KpiCard icon={Clock} label="کل منتظر بازگشایی مناقصه" value="۱۱ مورد" sub="ارزش: ۳۲۰K€" color={tokens.warning} />
              <KpiCard icon={Package} label="کل تحویل‌شده، منتظر تأیید فنی" value="۶ سفارش" sub="۱۸۵K€" color={tokens.accent} />
              <KpiCard icon={AlertTriangle} label="کل فاکتورهای منتظر پرداخت" value="۹ فاکتور" sub="۲۱۰K€" color={tokens.danger} />
            </>
          )}
        </div>

        {/* ویجت نرخ ارز و طلا */}
        <GoldCurrencyWidget />

        {/* ویجت TODO / یادآور */}
        <TodoWidget />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* نیاز به اقدام */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>نیاز به اقدام</p>
            <div className="space-y-2">
              {ACTION_ITEMS[role].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button key={idx} className="w-full flex items-center gap-2.5 text-right rounded-md px-3 py-2.5" style={{ background: tokens.bg }}>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${item.color}22`, color: item.color }}>
                      <Icon size={13} />
                    </div>
                    <span className="text-xs flex-1" style={{ color: tokens.textPrimary }}>{item.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* فعالیت اخیر */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>فعالیت اخیر</p>
            <div className="space-y-2.5">
              {RECENT_ACTIVITY.map((a, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <Avatar name={a.author} size={22} />
                  <div className="flex-1">
                    <span style={{ color: tokens.textSecondary }}>
                      <strong style={{ color: tokens.textPrimary }}>{a.author}</strong> {a.text}
                    </span>
                    <p className="text-[11px] mt-0.5" style={{ color: tokens.textSecondary }}>{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* توزیع وضعیت استعلام‌ها */}
          <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>توزیع وضعیت استعلام‌ها</p>
            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              {STATUS_DIST.map((s) => (
                <div key={s.label} style={{ width: `${(s.count / totalStatus) * 100}%`, background: s.color }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_DIST.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span style={{ color: tokens.textPrimary }}>{s.label}</span>
                  <span className="mono mr-auto" style={{ color: tokens.textSecondary }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* عملکرد تیم — فقط نمای مدیریتی */}
          {role === "manager" ? (
            <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} style={{ color: tokens.accent }} />
                <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>عملکرد تیم فروش</p>
              </div>
              <div className="space-y-2">
                {TEAM_PERFORMANCE.map((t) => (
                  <div key={t.name} className="flex items-center gap-2.5 text-xs rounded-md px-3 py-2" style={{ background: tokens.bg }}>
                    <Avatar name={t.name} size={22} />
                    <span className="flex-1" style={{ color: tokens.textPrimary }}>{t.name}</span>
                    <span className="mono" style={{ color: tokens.textSecondary }}>{t.active} فعال</span>
                    <span className="mono px-2 py-0.5 rounded-full" style={{ background: t.winRate >= 60 ? tokens.successSoft : tokens.warningSoft, color: t.winRate >= 60 ? tokens.success : tokens.warning }}>
                      {t.winRate}٪
                    </span>
                    <span className="mono font-semibold" style={{ color: tokens.textPrimary }}>{(t.value / 1000).toFixed(0)}K€</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
              <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>مهلت‌های نزدیک من</p>
              <div className="space-y-2">
                {[
                  { label: "مهلت ارائه پیشنهاد INQ-2026-0512", date: "۳ روز دیگر", urgent: true },
                  { label: "تاریخ تحویل تعهدشده INQ-2026-0417", date: "۱۲ روز دیگر", urgent: false },
                  { label: "پاسخ به نامه ۱۴۰۵-پ ت-۰۰۴۱", date: "فردا", urgent: true },
                ].map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs rounded-md px-3 py-2.5" style={{ background: tokens.bg }}>
                    <span style={{ color: tokens.textPrimary }}>{d.label}</span>
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: d.urgent ? "#F3E6E4" : tokens.successSoft, color: d.urgent ? tokens.danger : tokens.success }}>
                      {d.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
