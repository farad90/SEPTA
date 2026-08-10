import { CalendarDays } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { formatJalali } from "../../lib/jalali";
import { TeamApprovalsWidget } from "./TeamApprovalsWidget";
import { ReportsOverviewSection } from "./ReportsOverviewSection";

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim().split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary tracking-tight">
            {firstName ? `سلام، ${firstName}` : "داشبورد"}
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-textSecondary mt-1.5">
            <CalendarDays size={13} className="text-textSecondary/70" />
            {formatJalali(new Date())}
          </p>
        </div>
      </div>

      <ReportsOverviewSection />

      <TeamApprovalsWidget />
    </div>
  );
}
