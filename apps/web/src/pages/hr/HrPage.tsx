import { useState } from "react";
import { DepartmentsTab } from "./DepartmentsTab";
import { EmployeesTab } from "./EmployeesTab";
import { LeaveTypesTab } from "./LeaveTypesTab";
import { BenefitTypesTab } from "./BenefitTypesTab";
import { DeductionTypesTab } from "./DeductionTypesTab";
import { PayrollTab } from "./PayrollTab";
import { PerformanceReviewsTab } from "./PerformanceReviewsTab";

type TabKey =
  | "employees"
  | "departments"
  | "leaveTypes"
  | "benefitTypes"
  | "deductionTypes"
  | "payroll"
  | "performanceReviews";

export function HrPage() {
  const [tab, setTab] = useState<TabKey>("employees");

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-border overflow-hidden w-fit flex-wrap">
        {(
          [
            ["employees", "پرسنل"],
            ["departments", "بخش‌ها"],
            ["leaveTypes", "انواع مرخصی"],
            ["benefitTypes", "انواع مزایا"],
            ["deductionTypes", "انواع کسورات"],
            ["payroll", "فیش‌های حقوقی"],
            ["performanceReviews", "ارزیابی عملکرد"],
          ] as [TabKey, string][]
        ).map(([value, label]) => (
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

      {tab === "employees" && <EmployeesTab />}
      {tab === "departments" && <DepartmentsTab />}
      {tab === "leaveTypes" && <LeaveTypesTab />}
      {tab === "benefitTypes" && <BenefitTypesTab />}
      {tab === "deductionTypes" && <DeductionTypesTab />}
      {tab === "payroll" && <PayrollTab />}
      {tab === "performanceReviews" && <PerformanceReviewsTab />}
    </div>
  );
}
