import {
  BarChart3,
  Building2,
  Calculator,
  FileSearch,
  Image,
  Landmark,
  LayoutDashboard,
  LucideIcon,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  TrendingUp,
  Truck,
  UsersRound,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  /** اگر ست بشه، فقط با داشتن این کلید (یا حداقل یکی از این کلیدها) دسترسی در سایدبار دیده می‌شه */
  requiredPermission?: string | string[];
  /** ماژول‌هایی که هنوز پیاده نشدن — به PlaceholderPage می‌رن */
  placeholder?: string;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

// ساختار منو مطابق mockups/app-shell-mockup.jsx — ماژول‌های بدون کلید دسترسی
// (چت/مکاتبات/گزارش‌ها/داشبورد، دامنه‌های آینده) فعلاً برای همه نمایش داده می‌شن
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ key: "dashboard", label: "داشبورد", icon: LayoutDashboard, path: "/" }],
  },
  {
    title: "کار روزمره",
    items: [
      {
        key: "inquiries",
        label: "استعلام‌ها",
        icon: FileSearch,
        path: "/inquiries",
        requiredPermission: "inquiry.view",
      },
      {
        key: "chat",
        label: "پیام‌ها",
        icon: MessageSquare,
        path: "/chat",
      },
    ],
  },
  {
    title: "ماژول‌های سراسری",
    items: [
      {
        key: "shipments",
        label: "مدیریت بارها",
        icon: Truck,
        path: "/shipments",
        // عمداً shipping.view نیست — اون کلید به فروش هم داده شده (تب داخل پرونده، فاز ۱۰)
        // و باعث نشتی دسترسی به این ماژول سراسری می‌شد
        requiredPermission: ["shipping.manage_freight_rfq", "shipping.manage_shipment"],
      },
      {
        key: "partners",
        label: "شرکت‌ها و رابطین",
        icon: Building2,
        path: "/partners",
        requiredPermission: "partners.view",
      },
      {
        key: "catalog",
        label: "کالاها",
        icon: Package,
        path: "/catalog",
        requiredPermission: "catalog.view",
      },
      {
        key: "correspondence",
        label: "مکاتبات و بایگانی اسناد",
        icon: Mail,
        path: "/correspondence",
        requiredPermission: "correspondence.view_own_department",
      },
      {
        key: "hr",
        label: "منابع انسانی",
        icon: UsersRound,
        path: "/hr",
        requiredPermission: "hr.view",
      },
      {
        key: "payroll_engine",
        label: "حقوق و دستمزد",
        icon: Calculator,
        path: "/payroll-engine",
        requiredPermission: "payroll_engine.view",
      },
    ],
  },
  {
    title: "گزارش‌ها و تحلیل‌ها",
    items: [
      {
        key: "reports_orders_pnl",
        label: "گزارش سفارشات و سود و زیان",
        icon: TrendingUp,
        path: "/reports/orders-pnl",
        requiredPermission: "reports.view_orders_pnl",
      },
      {
        key: "reports_payments",
        label: "گزارش پرداختی‌ها و دریافتی‌ها",
        icon: Wallet,
        path: "/reports/payments",
        requiredPermission: "reports.view_payments",
      },
      {
        key: "reports_conversion",
        label: "گزارش تبدیل استعلام به سفارش",
        icon: BarChart3,
        path: "/reports/conversion",
        requiredPermission: "reports.view_conversion",
      },
      {
        key: "reports_personnel",
        label: "گزارش نفرات",
        icon: UsersRound,
        path: "/reports/personnel",
        placeholder: "گزارش عملکرد و آمار نفرات — به‌زودی",
      },
    ],
  },
  {
    title: "تنظیمات",
    items: [
      {
        key: "users",
        label: "کاربران و گروه‌های دسترسی",
        icon: Users,
        path: "/users",
        requiredPermission: "users.manage",
      },
      {
        key: "our_entities",
        label: "شرکت‌های ما",
        icon: Landmark,
        path: "/our-entities",
        requiredPermission: "our_entities.manage",
      },
      {
        key: "site_settings",
        label: "تنظیمات سامانه",
        icon: Image,
        path: "/site-settings",
        requiredPermission: "site_settings.manage",
      },
      {
        key: "broadcast_messages",
        label: "پیام‌های اعلامی",
        icon: Megaphone,
        path: "/broadcast-messages",
        requiredPermission: "broadcast_messages.manage",
      },
    ],
  },
];
