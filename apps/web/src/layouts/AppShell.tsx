import { useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ListChecks, LogOut, Menu, Palette, UserCircle, X } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { hasAnyPermission } from "../lib/permissions";
import { NAV_GROUPS } from "./nav-config";
import { useClickOutside } from "../lib/use-click-outside";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { AuthImage } from "../components/ui/AuthImage";
import { ChatWidget } from "../pages/chat/ChatWidget";
import { BroadcastPopupHost } from "../components/broadcast/BroadcastPopupHost";
import { WorkPanel } from "../components/work-panel/WorkPanel";
import { useActionCenterBadgeCount } from "../pages/action-center/action-center-api";

function Avatar({ name, size = 30, photoUrl }: { name: string; size?: number; photoUrl?: string | null }) {
  const colors = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const initials = name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  if (photoUrl) {
    return (
      <AuthImage
        fileUrl={photoUrl}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: colors[Math.abs(hash) % colors.length],
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </div>
  );
}

function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const { user } = useAuth();

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.requiredPermission || hasAnyPermission(user, item.requiredPermission),
        ),
      })).filter((group) => group.items.length > 0),
    [user],
  );

  const content = (
    <div className="flex flex-col h-full bg-primaryDark text-white w-64">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0">
          <img src="/assets/SEPTA_LOGO.png" alt="سپتا" className="w-8 h-8 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide">سپتا</p>
          <p className="text-[10px] text-white/50 truncate">سامانه یکپارچه پولاد تجهیز آپادانا</p>
        </div>
        <button
          className="lg:hidden mr-auto text-white/60 hover:text-white transition-colors duration-150 rounded-lg p-1 hover:bg-white/10"
          onClick={onCloseMobile}
          aria-label="بستن منو"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-5 sidebar-scroll">
        {visibleGroups.map((group, index) => (
          <div key={group.title ?? index}>
            {group.title && (
              <p className="px-5 mb-1.5 text-[10px] font-semibold text-white/35 tracking-wider">{group.title}</p>
            )}
            <ul className="px-2.5 space-y-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/"}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150 ease-smooth ${
                        isActive
                          ? "bg-white/[0.12] text-white font-medium shadow-xs border-r-2 border-accent"
                          : "text-white/65 hover:text-white hover:bg-white/[0.07]"
                      }`
                    }
                  >
                    <item.icon size={16} className="shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-[10px] text-white/40">
        پولاد تجهیز آپادانا · نسخه ۲
      </div>
    </div>
  );

  return (
    <>
      {/* دسکتاپ */}
      <aside className="hidden lg:block shrink-0 h-screen">{content}</aside>
      {/* موبایل — کشویی با overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 right-0 shadow-modal animate-sheet-in">{content}</aside>
        </div>
      )}
    </>
  );
}

function WorkPanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const count = useActionCenterBadgeCount();

  return (
    <button
      className={`relative text-textSecondary hover:text-textPrimary transition-colors duration-150 rounded-lg p-1.5 ${
        open ? "bg-bg text-textPrimary" : ""
      }`}
      onClick={onToggle}
      aria-label="کارها و اقدامات"
      title="کارها و اقدامات"
    >
      <ListChecks size={19} />
      {count > 0 && (
        <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

function Topbar({
  onMenuClick,
  pageTitle,
  workPanelOpen,
  onToggleWorkPanel,
}: {
  onMenuClick: () => void;
  pageTitle: string;
  workPanelOpen: boolean;
  onToggleWorkPanel: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false));

  return (
    <header className="flex items-center gap-3 px-4 sm:px-8 h-14 bg-surface border-b border-border shadow-xs sticky top-0 z-30">
      <button
        className="lg:hidden text-textSecondary hover:text-textPrimary transition-colors duration-150 rounded-lg p-1"
        onClick={onMenuClick}
        aria-label="باز کردن منو"
      >
        <Menu size={20} />
      </button>
      <h1 className="text-[15px] font-bold text-textPrimary truncate tracking-tight">{pageTitle}</h1>

      <div className="mr-auto flex items-center gap-1">
        <WorkPanelToggle open={workPanelOpen} onToggle={onToggleWorkPanel} />
        <NotificationBell />
      </div>

      <div className="relative" ref={menuRef}>
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-150 hover:bg-bg"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="منوی کاربر"
        >
          <Avatar name={user?.fullName ?? "؟"} photoUrl={user?.profilePhotoUrl} />
          <span className="hidden sm:block text-xs font-medium text-textPrimary">
            {user?.fullName}
          </span>
          <ChevronDown
            size={14}
            className={`text-textSecondary transition-transform duration-200 ease-smooth ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {menuOpen && (
          <div className="absolute left-0 mt-2 w-56 rounded-xl bg-surface border border-border shadow-dropdown py-1.5 z-50 origin-top-left animate-pop-in">
            <div className="px-4 py-2.5 border-b border-border mb-1">
              <p className="text-xs font-semibold text-textPrimary truncate">{user?.fullName}</p>
              <p className="text-[10px] text-textSecondary mt-0.5">
                گروه دسترسی: {user?.permissionGroup ?? "—"}
              </p>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate("/profile");
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-textPrimary transition-colors duration-150 hover:bg-bg"
            >
              <UserCircle size={14} className="text-textSecondary" />
              پروفایل من
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate("/profile?tab=appearance");
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-textPrimary transition-colors duration-150 hover:bg-bg"
            >
              <Palette size={14} className="text-textSecondary" />
              ظاهر و نمایش
            </button>
            <div className="mt-1 pt-1 border-t border-border">
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-danger transition-colors duration-150 hover:bg-danger/10"
              >
                <LogOut size={14} />
                خروج از سامانه
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workPanelOpen, setWorkPanelOpen] = useState(false);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)) {
          return item.label;
        }
      }
    }
    return "سپتا";
  }, [location.pathname]);

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-bg font-vazir">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          pageTitle={pageTitle}
          workPanelOpen={workPanelOpen}
          onToggleWorkPanel={() => setWorkPanelOpen((open) => !open)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          {/* فاز ۵۹ — صفحاتی که جدول‌های داده‌ی عریض دارن (مثل لیست استعلام‌ها) از سقف
              max-w-6xl خارج می‌شن تا روی مانیتورهای بزرگ کل عرض صفحه رو پوشش بدن؛ بقیه‌ی
              صفحات (فرم‌ها/جزئیات) همون عرض قابل‌خواندن قبلی رو حفظ می‌کنن.
              فاز ۵۹-ب — /inquiries علاوه بر عرض کامل، ارتفاع کامل (h-full) هم می‌گیره، چون
              خودِ صفحه (InquiriesListPage) با flex-1/min-h-0 داخلی می‌خواد دقیقاً فضای باقی‌مانده‌ی
              main رو پر کنه (نه اینکه main خودش اسکرول بخوره) — این wrapper بدون h-full هیچ
              ارتفاع معینی نداشت، پس h-full داخل صفحه به‌جایی زنجیر نمی‌شد. فقط همین یک مسیر
              رو تغییر می‌ده؛ بقیه‌ی صفحات (که به auto-height/mx-auto نیاز دارن) دست‌نخورده می‌مونن. */}
          <div
            className={
              location.pathname === "/inquiries" ? "w-full h-full" : "max-w-6xl w-full mx-auto"
            }
          >
            <Outlet />
          </div>
        </main>
      </div>
      {/* Work Panel — با کلیک روی آیکون کنار نوتیفیکیشن، به‌صورت Overlay باز می‌شه (بدون اشغال فضای دائمی) */}
      <WorkPanel open={workPanelOpen} onClose={() => setWorkPanelOpen(false)} />
      {location.pathname !== "/chat" && <ChatWidget />}
      <BroadcastPopupHost />
    </div>
  );
}
