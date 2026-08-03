export type PaletteKey = "default" | "ocean" | "forest" | "sepia" | "charcoal";
export type FontSizeKey = "small" | "medium" | "large";
export type FontFamilyKey = "vazirmatn" | "cairo" | "notoSansArabic";

export interface PaletteOption {
  key: PaletteKey;
  label: string;
  /** برای نمایش سواچ در UI انتخاب — مقادیر هگز نسخه روشن همون پالت */
  swatch: { bg: string; primary: string; accent: string };
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  {
    key: "default",
    label: "پیش‌فرض",
    swatch: { bg: "#F6F4EF", primary: "#1F3A5F", accent: "#A9633B" },
  },
  {
    key: "ocean",
    label: "اقیانوسی",
    swatch: { bg: "#EDF5F8", primary: "#155E82", accent: "#2B8A96" },
  },
  {
    key: "forest",
    label: "جنگلی",
    swatch: { bg: "#F1F5EE", primary: "#2B5C3A", accent: "#7A8F37" },
  },
  {
    key: "sepia",
    label: "سپیا",
    swatch: { bg: "#F6F0E6", primary: "#6C4A2E", accent: "#A9633B" },
  },
  {
    key: "charcoal",
    label: "زغالی",
    swatch: { bg: "#F7F7F8", primary: "#15803D", accent: "#4F46E5" },
  },
];

export interface FontSizeOption {
  key: FontSizeKey;
  label: string;
  /** px — روی document.documentElement.style.fontSize ست می‌شه */
  px: number;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { key: "small", label: "کوچک", px: 14 },
  { key: "medium", label: "متوسط", px: 16 },
  { key: "large", label: "بزرگ", px: 18 },
];

export interface FontFamilyOption {
  key: FontFamilyKey;
  label: string;
  /** روی --font-fa ست می‌شه (theme.css) — مستقل از پالت رنگی، هر پالتی با هر فونتی قابل‌تجربه‌ست */
  stack: string;
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { key: "vazirmatn", label: "وزیرمتن", stack: '"Vazirmatn", sans-serif' },
  { key: "cairo", label: "کایرو", stack: '"Cairo", "Vazirmatn", sans-serif' },
  {
    key: "notoSansArabic",
    label: "نوتو سنس عربیک",
    stack: '"Noto Sans Arabic", "Vazirmatn", sans-serif',
  },
];
