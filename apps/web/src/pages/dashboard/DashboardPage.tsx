import { useAuth } from "../../lib/auth-context";
import { formatJalali } from "../../lib/jalali";
import { TeamApprovalsWidget } from "./TeamApprovalsWidget";
import { ReportsOverviewSection } from "./ReportsOverviewSection";

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim().split(" ")[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-textPrimary tracking-tight">
            {firstName ? `سلام، ${firstName}` : "داشبورد"}
          </h1>
          <p className="text-xs text-textSecondary mt-0.5">{formatJalali(new Date())}</p>
        </div>
      </div>

      <ReportsOverviewSection />

      <TeamApprovalsWidget />
    </div>
  );
}
