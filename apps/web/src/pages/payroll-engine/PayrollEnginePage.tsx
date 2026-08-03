import { useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { ConfigTab } from "./ConfigTab";
import { ProfileTab } from "./ProfileTab";
import { ResultsTab } from "./ResultsTab";
import { RunTab } from "./RunTab";

type TabKey = "config" | "profiles" | "run" | "results";

export function PayrollEnginePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>(hasPermission(user, "payroll_engine.manage_config") ? "config" : "run");

  const tabs: [TabKey, string][] = [
    ["config", "تنظیمات (قوانین و فرمول‌ها)"],
    ["profiles", "پروفایل حقوقی پرسنل"],
    ["run", "کارکرد و اجرای محاسبه"],
    ["results", "نتایج و فیش حقوقی"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-textPrimary">حقوق و دستمزد</h1>
        <p className="text-xs text-textSecondary">
          موتور محاسبه‌ی حقوق بر مبنای قوانین نسخه‌بندی‌شده — بدون هیچ عدد/فرمول هاردکد در کد.
        </p>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden w-fit flex-wrap">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 text-xs font-medium ${
              tab === value ? "bg-primary text-white" : "bg-surface text-textSecondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "config" && <ConfigTab />}
      {tab === "profiles" && <ProfileTab />}
      {tab === "run" && <RunTab />}
      {tab === "results" && <ResultsTab />}
    </div>
  );
}
