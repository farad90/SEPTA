import { useState } from "react";
import { Lock, Truck } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { FreightTab } from "./FreightTab";
import { ShipmentsTab } from "./ShipmentsTab";

const MODULE_TABS = [
  { key: "freight", label: "استعلام حمل" },
  { key: "shipments", label: "بارها" },
] as const;

export function ShipmentManagementPage() {
  const { user } = useAuth();
  const canFreight = hasPermission(user, "shipping.manage_freight_rfq");
  const canShipment = hasPermission(user, "shipping.manage_shipment");
  const [activeTab, setActiveTab] = useState<(typeof MODULE_TABS)[number]["key"]>(canFreight ? "freight" : "shipments");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Truck size={20} className="text-primary" />
        <h1 className="text-lg font-bold text-textPrimary">مدیریت بارها</h1>
      </div>
      <p className="text-xs rounded-lg px-3 py-2 mb-4 bg-warningSoft text-warning flex items-center gap-1.5 w-fit">
        <Lock size={12} /> این ماژول فقط برای بازرگانی و مدیریت قابل مشاهده است
      </p>

      <div className="flex gap-1 border-b border-border mb-4">
        {MODULE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-textSecondary hover:text-textPrimary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "freight" && <FreightTab canEdit={canFreight} />}
      {activeTab === "shipments" && <ShipmentsTab canEdit={canShipment} />}
    </div>
  );
}
