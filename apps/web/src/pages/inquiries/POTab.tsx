import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { FlexPaymentList } from "../../components/ui/FlexPaymentList";
import { InquiryDetail } from "./inquiry-types";
import { useOurEntities } from "./rfqs-api";
import { usePurchaseOrders, usePoMutations } from "./po-api";
import { PoGroup, SUPPLIER_PAYMENT_STATUS_OPTIONS } from "./po-types";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

interface HeaderDraft {
  poNumber: string;
  ourEntityId: string;
  issueDate: string | null;
  deliveryDueDate: string | null;
}

function PoCard({
  inquiryId,
  group,
  ourEntities,
  canCreate,
  canManagePayments,
}: {
  inquiryId: string;
  group: PoGroup;
  ourEntities: { id: string; entityName: string }[];
  canCreate: boolean;
  canManagePayments: boolean;
}) {
  const mutations = usePoMutations(inquiryId);
  const [header, setHeader] = useState<HeaderDraft>(() =>
    group.exists
      ? { poNumber: group.poNumber, ourEntityId: group.ourEntityId, issueDate: group.issueDate, deliveryDueDate: group.deliveryDueDate }
      : { poNumber: group.defaultPoNumber, ourEntityId: group.defaultOurEntityId ?? "", issueDate: null, deliveryDueDate: null },
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (group.exists) {
      setHeader({ poNumber: group.poNumber, ourEntityId: group.ourEntityId, issueDate: group.issueDate, deliveryDueDate: group.deliveryDueDate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.exists && group.id]);

  const items = group.exists ? group.items : group.previewItems;
  const total = group.exists ? group.totalAmount : items.reduce((s, i) => s + i.price * i.quantity, 0);

  async function saveHeader() {
    try {
      setError(null);
      await mutations.save.mutateAsync({
        supplierId: group.supplierId,
        body: {
          poNumber: header.poNumber || undefined,
          ourEntityId: header.ourEntityId || undefined,
          issueDate: header.issueDate || undefined,
          deliveryDueDate: header.deliveryDueDate || undefined,
        },
      });
      setNotice("ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setError(extractError(err, "خطا در صدور/ذخیره PO"));
    }
  }

  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-accent" />
          <span className="text-sm font-semibold text-textPrimary">{group.supplierName}</span>
        </div>
        <span className="font-mono text-xs font-semibold text-primary" dir="ltr">
          {fmt(total)} {group.exists ? group.currencyCode : ""}
        </span>
      </div>

      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      {notice && <p className="text-xs text-success mb-2">{notice}</p>}

      <div className="mb-3">
        <label className="block text-[11px] mb-1 font-medium text-accent">شرکت ما (طرف خریدار در این PO)</label>
        <Select
          disabled={!canCreate}
          value={header.ourEntityId}
          onChange={(e) => setHeader((h) => ({ ...h, ourEntityId: e.target.value }))}
          className="!py-1.5 text-xs"
        >
          <option value="">انتخاب کنید...</option>
          {ourEntities.map((e) => (
            <option key={e.id} value={e.id}>{e.entityName}</option>
          ))}
        </Select>
        <span className="text-[11px] mr-2 text-textSecondary">(همون شرکتی که RFQ اولیه از طریقش ارسال شده بود)</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label className="block text-[11px] mb-1 text-textSecondary">شماره PO</label>
          <TextInput
            disabled={!canCreate}
            value={header.poNumber}
            onChange={(e) => setHeader((h) => ({ ...h, poNumber: e.target.value }))}
            className="font-mono !py-1.5 text-xs"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-[11px] mb-1 text-textSecondary">تاریخ صدور</label>
          <DualDateInput value={header.issueDate} onChange={(v) => canCreate && setHeader((h) => ({ ...h, issueDate: v }))} />
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {items.map((it) => (
          <div key={it.orderItemId} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs bg-bg">
            <span className="font-mono text-textSecondary" dir="ltr">{it.itemCode}</span>
            <span className="text-textPrimary">{it.description}</span>
            <span className="font-mono text-textSecondary" dir="ltr">{it.quantity} {it.measurementUnit}</span>
          </div>
        ))}
      </div>

      {canCreate && (
        <div className="flex justify-end mb-3">
          <PrimaryButton onClick={saveHeader} disabled={mutations.save.isPending}>
            {group.exists ? "ذخیره تغییرات" : "صدور PO"}
          </PrimaryButton>
        </div>
      )}

      {group.exists && (
        <FlexPaymentList
          title={`پرداخت به ${group.supplierName}`}
          rows={group.supplierPayments}
          statusOptions={SUPPLIER_PAYMENT_STATUS_OPTIONS}
          canEdit={canManagePayments}
          showPaymentMethod
          onCreate={(body) => mutations.addPayment.mutateAsync({ supplierId: group.supplierId, body })}
          onUpdate={(id, body) => mutations.updatePayment.mutateAsync({ id, body })}
          onDelete={(id) => mutations.deletePayment.mutateAsync(id)}
        />
      )}
    </div>
  );
}

export function POTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canView = hasPermission(user, "po.view");
  const canCreate = hasPermission(user, "po.create");
  const canManagePayments = hasPermission(user, "po.manage_payments");

  const { data, isLoading, isError, error } = usePurchaseOrders(inquiry.id);
  const { data: ourEntities } = useOurEntities();

  if (!canView) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p></div>;
  }
  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) {
    return (
      <div className="rounded-lg px-4 py-3 text-xs flex items-center gap-2 bg-warningSoft text-textPrimary">
        {extractError(error, "ابتدا باید سفارش مشتری (تب ۶) ثبت بشه")}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg px-4 py-2.5 mb-5 text-xs bg-accentSoft text-textPrimary">
        این بخش مربوط به <strong>بازرگانی/مدیریت</strong> است و به فروش ربطی نداره. هر سفارش خرید باید از
        طریق یکی از <strong>شرکت‌های گروه ما</strong> صادر بشه — همون شرکتی که استعلام اولیه (RFQ) هم از
        طریقش ارسال شده بود.
      </div>

      {data.length === 0 ? (
        <p className="text-xs text-textSecondary py-8 text-center">
          هنوز قلم برنده‌ای در سفارش مشتری این پرونده ثبت نشده.
        </p>
      ) : (
        <div className="space-y-4">
          {data.map((group) => (
            <PoCard
              key={group.supplierId}
              inquiryId={inquiry.id}
              group={group}
              ourEntities={ourEntities ?? []}
              canCreate={canCreate}
              canManagePayments={canManagePayments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
