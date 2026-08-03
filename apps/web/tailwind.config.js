/** @type {import('tailwindcss').Config} */
// فاز ۴۱-الف: رنگ‌ها به‌جای hex ثابت، به متغیرهای CSS ارجاع می‌دن (تعریف‌شده در src/styles/theme.css)
// تا امکان چند پالت + دارک‌مود بدون دست‌زدن به کلاس‌های Tailwind در کامپوننت‌ها فراهم بشه.
const withOpacity = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--color-bg"),
        surface: withOpacity("--color-surface"),
        primary: withOpacity("--color-primary"),
        primaryDark: withOpacity("--color-primaryDark"),
        accent: withOpacity("--color-accent"),
        accentSoft: withOpacity("--color-accentSoft"),
        border: withOpacity("--color-border"),
        textPrimary: withOpacity("--color-textPrimary"),
        textSecondary: withOpacity("--color-textSecondary"),
        danger: withOpacity("--color-danger"),
        success: withOpacity("--color-success"),
        successSoft: withOpacity("--color-successSoft"),
        warning: withOpacity("--color-warning"),
        warningSoft: withOpacity("--color-warningSoft"),
      },
      fontFamily: {
        // توکن‌شده (--font-fa در theme.css) تا پالت زغالی بتونه فونت مستقل خودشو داشته باشه
        vazir: ["var(--font-fa)", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      // سایه‌ها طبق SepTa Design System v1.0 — Elevation: «کارت‌ها فقط ۱px border، سایه فقط
      // روی hover (0 8px 24px rgba(0,0,0,0.08))، از سایه‌های تزئینی پرهیز شود». shadow-card
      // عمداً تقریباً نامرئیه (صرفاً یک لبه‌ی ظریف کنار border، نه یک سایه‌ی واقعی)؛ عمق واقعی
      // فقط با card-hover روی state هاور کارت‌های تعاملی اضافه می‌شه.
      boxShadow: {
        xs: "0 1px 2px 0 rgb(var(--color-primaryDark) / 0.03)",
        card: "0 1px 2px 0 rgb(var(--color-primaryDark) / 0.02)",
        "card-hover": "0 8px 24px 0 rgb(var(--color-primaryDark) / 0.08)",
        dropdown:
          "0 4px 6px -2px rgb(var(--color-primaryDark) / 0.05), 0 12px 24px -6px rgb(var(--color-primaryDark) / 0.14)",
        modal:
          "0 8px 10px -6px rgb(var(--color-primaryDark) / 0.08), 0 20px 40px -8px rgb(var(--color-primaryDark) / 0.20)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": {
          from: { opacity: 0, transform: "scale(0.96) translateY(-2px)" },
          to: { opacity: 1, transform: "scale(1) translateY(0)" },
        },
        "sheet-in": {
          from: { opacity: 0, transform: "scale(0.98) translateY(6px)" },
          to: { opacity: 1, transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "pop-in": "pop-in 160ms cubic-bezier(0.4, 0, 0.2, 1)",
        "sheet-in": "sheet-in 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
