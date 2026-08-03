import React, { useState } from "react";
import {
  LayoutDashboard,
  FileSearch,
  Package,
  Building2,
  Mail,
  Truck,
  BarChart3,
  Users,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Settings,
  LogOut,
  Lock,
  Clock,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  MessageSquare,
  UserCircle,
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
  warning: "#B98900",
  warningSoft: "#FBF2DA",
};

// ------------------------------------------------------------
// ساختار منو — بر اساس گروه دسترسی کاربر جاری فیلتر می‌شه
// ------------------------------------------------------------
const NAV_GROUPS = [
  {
    items: [{ key: "dashboard", label: "داشبورد", icon: LayoutDashboard }],
  },
  {
    title: "کار روزمره",
    items: [
      { key: "inquiries", label: "استعلام‌ها", icon: FileSearch },
      { key: "chat", label: "پیام‌ها", icon: MessageSquare },
    ],
  },
  {
    title: "ماژول‌های سراسری",
    items: [
      { key: "shipments", label: "مدیریت بارها", icon: Truck, restricted: "بازرگانی/مدیریت" },
      { key: "partners", label: "شرکت‌ها و رابطین", icon: Building2 },
      { key: "catalog", label: "کاتالوگ کالا", icon: Package },
      { key: "correspondence", label: "مکاتبات و بایگانی اسناد", icon: Mail },
    ],
  },
  {
    title: "گزارش‌ها",
    items: [{ key: "reports", label: "تحلیل برد و باخت", icon: BarChart3 }],
  },
  {
    title: "تنظیمات",
    items: [{ key: "users", label: "کاربران و گروه‌های دسترسی", icon: Users }],
  },
];

function Avatar({ name, size = 28 }) {
  const colors = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: colors[Math.abs(hash) % colors.length], fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// ------------------------------------------------------------
// سایدبار
// ------------------------------------------------------------
function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(20,18,14,0.45)" }} onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-50 lg:z-0 h-screen w-64 shrink-0 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
        style={{ background: tokens.primaryDark, borderLeft: `1px solid ${tokens.border}` }}
      >
        {/* برند */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "#fff" }}
            >
              <img src="./assets/SEPTA_LOGO.png" alt="سپتا" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">سپتا</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>پولاد تجهیز آپادانا</p>
            </div>
          </div>
          <button className="lg:hidden text-white" onClick={onCloseMobile}>
            <X size={18} />
          </button>
        </div>

        {/* منو */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="mb-5">
              {group.title && (
                <p className="text-[10px] font-medium px-3 mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = current === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onNavigate(item.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-right"
                      style={{
                        background: active ? tokens.accent : "transparent",
                        color: active ? "#fff" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      <Icon size={16} />
                      <span className="flex-1">{item.label}</span>
                      {item.restricted && (
                        <Lock size={11} style={{ color: active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* کاربر جاری پایین سایدبار */}
        <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2.5">
            <Avatar name="فرشید محمدی" size={30} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">فرشید محمدی</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>مدیر فروش و بازرگانی</p>
            </div>
            <button style={{ color: "rgba(255,255,255,0.5)" }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ------------------------------------------------------------
// نوار بالا
// ------------------------------------------------------------
function Topbar({ onMenuClick, pageTitle }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "علی محمدی شما را در INQ-2026-0417 منشن کرد", time: "۱۰ دقیقه پیش", unread: true, actions: null },
    { id: 2, text: "RFQ-1044 بیش از ۳ روزه بدون پاسخه", time: "۲ ساعت پیش", unread: true, actions: null },
    { id: 3, text: "درخواست تخفیف ۸٪ روی INQ-2026-0512 نیاز به تأیید شما دارد", time: "۳ ساعت پیش", unread: true, actions: ["تأیید", "رد"] },
    { id: 4, text: "فاکتور INV-0398 صادر شد", time: "دیروز", unread: false, actions: null },
  ]);

  const actOnNotif = (id, action) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, actioned: action, actions: null, unread: false } : n)));
  };

  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3.5"
      style={{ background: tokens.surface, borderBottom: `1px solid ${tokens.border}` }}
    >
      <button className="lg:hidden" onClick={onMenuClick} style={{ color: tokens.textSecondary }}>
        <Menu size={20} />
      </button>

      <h2 className="text-sm font-semibold hidden sm:block" style={{ color: tokens.textPrimary }}>{pageTitle}</h2>

      <div className="relative flex-1 max-w-md mr-auto">
        <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
        <input
          placeholder="جست‌وجوی سراسری (استعلام، شرکت، نامه...)"
          className="w-full rounded-md pr-9 pl-3 py-2 text-sm"
          style={{ border: `1px solid ${tokens.border}`, background: tokens.bg }}
        />
      </div>

      <div className="relative">
        <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }} className="relative p-2 rounded-md" style={{ color: tokens.textSecondary }}>
          <Bell size={18} />
          {notifications.some((n) => n.unread) && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: tokens.danger }} />
          )}
        </button>
        {notifOpen && (
          <div className="absolute left-0 mt-2 w-80 rounded-lg overflow-hidden z-40 max-h-96 overflow-y-auto" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
            <p className="text-xs font-semibold px-4 py-2.5 sticky top-0" style={{ borderBottom: `1px solid ${tokens.border}`, color: tokens.textPrimary, background: tokens.surface }}>اعلان‌ها</p>
            {notifications.map((n, idx) => (
              <div key={n.id} className="px-4 py-2.5 text-xs" style={{ borderBottom: idx < notifications.length - 1 ? `1px solid ${tokens.border}` : "none", background: n.unread ? tokens.accentSoft : "transparent" }}>
                <p style={{ color: tokens.textPrimary }}>{n.text}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p style={{ color: tokens.textSecondary }}>{n.time}</p>
                  {n.actioned && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.successSoft, color: tokens.success }}>
                      {n.actioned} شد ✓
                    </span>
                  )}
                </div>
                {n.actions && (
                  <div className="flex gap-1.5 mt-2">
                    {n.actions.map((a) => (
                      <button
                        key={a}
                        onClick={() => actOnNotif(n.id, a)}
                        className="text-[11px] px-3 py-1 rounded-md font-medium"
                        style={a === "تأیید" ? { background: tokens.primary, color: "#fff" } : { color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} className="flex items-center gap-2">
          <Avatar name="فرشید محمدی" size={30} />
          <ChevronDown size={14} style={{ color: tokens.textSecondary }} />
        </button>
        {profileOpen && (
          <div className="absolute left-0 mt-2 w-48 rounded-lg overflow-hidden z-40" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-right hover:bg-black/5" style={{ color: tokens.textPrimary }}>
              <UserCircle size={13} /> پروفایل من
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-right hover:bg-black/5" style={{ color: tokens.textPrimary }}>
              <Settings size={13} /> تنظیمات حساب
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-right hover:bg-black/5" style={{ color: tokens.danger }}>
              <LogOut size={13} /> خروج از حساب
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// محتوای صفحه اصلی (داشبورد)
// ------------------------------------------------------------
function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2" style={{ background: `${color}22`, color }}>
        <Icon size={16} />
      </div>
      <p className="text-xl font-bold" style={{ color: tokens.textPrimary }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: tokens.textSecondary }}>{label}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: tokens.textSecondary }}>{sub}</p>}
    </div>
  );
}

function HomeDashboard() {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: tokens.textSecondary }}>سلام فرشید، امروز ۱۴۰۵/۰۴/۱۶</p>
      <h1 className="text-xl font-bold mb-5" style={{ color: tokens.textPrimary }}>داشبورد</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Package} label="استعلام‌های فعال" value="۱۸" color={tokens.primary} />
        <KpiCard icon={TrendingUp} label="نرخ برد تیم" value="۶۴٪" color={tokens.success} />
        <KpiCard icon={DollarSign} label="ارزش پایپ‌لاین" value="۴۸۵K€" color={tokens.accent} />
        <KpiCard icon={AlertTriangle} label="نیاز به پیگیری" value="۶" color={tokens.warning} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>نیاز به اقدام</p>
          <div className="space-y-2">
            {[
              { icon: Clock, text: "RFQ-1044 به Bulten Fasteners بیش از ۳ روزه بدون پاسخه", color: tokens.warning },
              { icon: Mail, text: "نامه ۱۴۰۵-پ ت-۰۰۴۱ نیاز به پاسخ تا فردا داره", color: tokens.danger },
              { icon: Bell, text: "علی محمدی شما را در INQ-2026-0417 منشن کرد", color: tokens.primary },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center gap-2.5 rounded-md px-3 py-2.5" style={{ background: tokens.bg }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${item.color}22`, color: item.color }}>
                    <Icon size={13} />
                  </div>
                  <span className="text-xs" style={{ color: tokens.textPrimary }}>{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>فعالیت اخیر</p>
          <div className="space-y-2.5">
            {[
              { author: "علی محمدی", text: "فایل‌های پیشنهاد INQ-2026-0417 را برای مشتری ارسال کرد", time: "۲ ساعت پیش" },
              { author: "سارا کریمی", text: "نتیجه «برد» را برای INQ-2026-0301 ثبت کرد", time: "دیروز" },
              { author: "مریم صادقی", text: "فاکتور INV-0398 را صادر کرد", time: "۲ روز پیش" },
            ].map((a, idx) => (
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
    </div>
  );
}

// صفحه‌های دیگر — هرکدوم ماژول مستقل خودشونو دارن (فایل‌های جدا)؛ اینجا فقط جای درست‌شون در ناوبری نشون داده می‌شه
function PlaceholderPage({ title, icon: Icon, note }) {
  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: tokens.textPrimary }}>{title}</h1>
      <p className="text-xs mb-6" style={{ color: tokens.textSecondary }}>{note}</p>
      <div className="rounded-lg p-10 text-center" style={{ background: tokens.surface, border: `1px dashed ${tokens.border}` }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: tokens.accentSoft, color: tokens.accent }}>
          <Icon size={22} />
        </div>
        <p className="text-sm" style={{ color: tokens.textSecondary }}>
          این بخش همون ماژول مستقلیه که قبلاً کامل طراحی شد — اینجا فقط جایگاهش در ناوبری اصلیه.
        </p>
      </div>
    </div>
  );
}

const PAGE_META = {
  dashboard: { title: "داشبورد", icon: LayoutDashboard },
  inquiries: { title: "استعلام‌ها", icon: FileSearch, note: "لیست کامل استعلام‌ها با فیلتر/جست‌وجو/سورت" },
  chat: { title: "پیام‌ها", icon: MessageSquare, note: "پیام‌رسانی سازمانی با قابلیت ساخت گروه" },
  shipments: { title: "مدیریت بارها", icon: Truck, note: "بسته‌بندی، استعلام حمل، پیگیری ترخیص — فقط بازرگانی/مدیریت" },
  partners: { title: "شرکت‌ها و رابطین", icon: Building2, note: "مدیریت مشتری/تأمین‌کننده/سازمان/بانک و رابطین‌شون" },
  catalog: { title: "کاتالوگ کالا", icon: Package, note: "کاتالوگ مرکزی کالاها با فیلتر برند و سابقه استفاده" },
  correspondence: { title: "مکاتبات و بایگانی اسناد", icon: Mail, note: "نامه‌های وارده/صادره/داخلی و بایگانی اسناد" },
  reports: { title: "تحلیل برد و باخت", icon: BarChart3, note: "گزارش کامل دلایل باخت، رقبا و عملکرد تیم" },
  users: { title: "کاربران و گروه‌های دسترسی", icon: Users, note: "مدیریت کاربران و دسترسی‌های ریز هر گروه" },
};

export default function AppShellMockup() {
  const [current, setCurrent] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const meta = PAGE_META[current];

  return (
    <div dir="rtl" style={{ fontFamily: "Vazirmatn, sans-serif" }} className="flex min-h-screen" >
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>

      <Sidebar current={current} onNavigate={(k) => { setCurrent(k); setMobileOpen(false); }} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0" style={{ background: tokens.bg }}>
        <Topbar onMenuClick={() => setMobileOpen(true)} pageTitle={meta.title} />
        <main className="flex-1 p-4 sm:p-8 max-w-5xl w-full mx-auto">
          {current === "dashboard" ? <HomeDashboard /> : <PlaceholderPage title={meta.title} icon={meta.icon} note={meta.note} />}
        </main>
      </div>
    </div>
  );
}
