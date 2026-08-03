import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./layouts/AppShell";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { PartnersPage } from "./pages/partners/PartnersPage";
import { CatalogPage } from "./pages/catalog/CatalogPage";
import { UsersPage } from "./pages/users/UsersPage";
import { InquiriesListPage } from "./pages/inquiries/InquiriesListPage";
import { InquiryFormPage } from "./pages/inquiries/InquiryFormPage";
import { InquiryDetailPage } from "./pages/inquiries/InquiryDetailPage";
import { DeletedInquiriesPage } from "./pages/inquiries/DeletedInquiriesPage";
import { ShipmentManagementPage } from "./pages/shipments/ShipmentManagementPage";
import { CorrespondenceListPage } from "./pages/correspondence/CorrespondenceListPage";
import { CorrespondenceDetailPage } from "./pages/correspondence/CorrespondenceDetailPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { ActionCenterPage } from "./pages/action-center/ActionCenterPage";
import { ChatPage } from "./pages/chat/ChatPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { HrPage } from "./pages/hr/HrPage";
import { OurEntitiesPage } from "./pages/our-entities/OurEntitiesPage";
import { SiteSettingsPage } from "./pages/site-settings/SiteSettingsPage";
import { BroadcastMessagesPage } from "./pages/broadcast-messages/BroadcastMessagesPage";
import { PayrollEnginePage } from "./pages/payroll-engine/PayrollEnginePage";
import { OrdersPnlReportPage } from "./pages/reports/OrdersPnlReportPage";
import { PaymentsReportPage } from "./pages/reports/PaymentsReportPage";
import { ConversionReportPage } from "./pages/reports/ConversionReportPage";
import { NAV_GROUPS } from "./layouts/nav-config";

// روت‌های Placeholder ماژول‌های آینده — از همون تعریف ناوبری ساخته می‌شن
const placeholderRoutes = NAV_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.placeholder),
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/action-center" element={<ActionCenterPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/inquiries" element={<InquiriesListPage />} />
          <Route path="/inquiries/new" element={<InquiryFormPage />} />
          <Route path="/inquiries/deleted" element={<DeletedInquiriesPage />} />
          <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
          <Route path="/shipments" element={<ShipmentManagementPage />} />
          <Route path="/correspondence" element={<CorrespondenceListPage />} />
          <Route path="/correspondence/:id" element={<CorrespondenceDetailPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/hr" element={<HrPage />} />
          <Route path="/our-entities" element={<OurEntitiesPage />} />
          <Route path="/site-settings" element={<SiteSettingsPage />} />
          <Route path="/broadcast-messages" element={<BroadcastMessagesPage />} />
          <Route path="/payroll-engine" element={<PayrollEnginePage />} />
          <Route path="/reports/orders-pnl" element={<OrdersPnlReportPage />} />
          <Route path="/reports/payments" element={<PaymentsReportPage />} />
          <Route path="/reports/conversion" element={<ConversionReportPage />} />
          {placeholderRoutes.map((item) => (
            <Route
              key={item.key}
              path={item.path}
              element={<PlaceholderPage title={item.label} icon={item.icon} note={item.placeholder!} />}
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
