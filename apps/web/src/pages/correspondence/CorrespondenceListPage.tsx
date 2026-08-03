import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileEdit, Mail, MailOpen, Plus, Search } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { formatJalali } from "../../lib/jalali";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { useOurEntities } from "../inquiries/rfqs-api";
import { useInquiries } from "../inquiries/inquiries-api";
import { useShipments } from "../shipments/shipment-api";
import { useColleagues } from "../users/users-api";
import { useDepartments } from "../hr/hr-api";
import { PartySelector } from "./PartySelector";
import { LetterPartyBody, SaveLetterBody, useLetterMutations, useLetters } from "./correspondence-api";
import { DEPARTMENTS, LETTER_TYPES, PRIORITY_META, STATUS_META, TYPE_META } from "./correspondence-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

const TYPE_ICON = { incoming: MailOpen, outgoing: Mail, internal: FileEdit };

function NewLetterForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { data: ourEntities } = useOurEntities();
  const { data: inquiriesPage } = useInquiries({});
  const { data: shipments } = useShipments();
  const { data: colleagues } = useColleagues();
  const { data: allDepartments } = useDepartments();
  const { create } = useLetterMutations();

  const [type, setType] = useState<(typeof LETTER_TYPES)[number]>("incoming");
  const [subject, setSubject] = useState("");
  const [letterDate, setLetterDate] = useState<string | null>(null);
  const [department, setDepartment] = useState("فروش");
  const [priority, setPriority] = useState("normal");
  const [sender, setSender] = useState<LetterPartyBody>({});
  const [receiver, setReceiver] = useState<LetterPartyBody>({});
  const [issuingEntityId, setIssuingEntityId] = useState("");
  const [linkType, setLinkType] = useState<"none" | "inquiry" | "shipment">("none");
  const [linkValue, setLinkValue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // فاز ۲۴ — فیلدهای وابسته به جهت نامه
  const [senderReferenceNumber, setSenderReferenceNumber] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [signerUserIds, setSignerUserIds] = useState<string[]>([]);
  const [internalFromDepartmentId, setInternalFromDepartmentId] = useState("");
  const [internalToDepartmentId, setInternalToDepartmentId] = useState("");

  const entities = ourEntities ?? [];
  const departmentsForEntity = useMemo(
    () => (allDepartments ?? []).filter((d) => d.ourEntityId === issuingEntityId),
    [allDepartments, issuingEntityId],
  );

  const isIncoming = type === "incoming";
  const isOutgoing = type === "outgoing";
  const isInternal = type === "internal";

  const canSubmit =
    subject.trim() &&
    letterDate &&
    issuingEntityId &&
    (isInternal
      ? internalFromDepartmentId && internalToDepartmentId && internalFromDepartmentId !== internalToDepartmentId
      : isIncoming
        ? sender.partnerId && receiver.ourEntityId && senderReferenceNumber.trim() && responsibleUserId
        : sender.ourEntityId && receiver.partnerId && signerUserIds.length > 0);

  return (
    <div className="rounded-lg p-4 mb-5 bg-surface border border-border border-r-4 border-r-primary">
      <p className="text-sm font-semibold mb-3 text-textPrimary">ثبت نامه جدید</p>
      <p className="text-[11px] mb-3 text-textSecondary">
        کد داخل شماره، کد اختصاری شرکت صادرکننده/دریافت‌کننده است (نه جهت نامه)؛ شماره نهایی فقط بعد از «ثبت رسمی» صادر می‌شه.
      </p>

      <Field label="نوع نامه">
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value as typeof type);
            setSender({});
            setReceiver({});
          }}
        >
          <option value="incoming">دریافتی</option>
          <option value="outgoing">ارسالی</option>
          <option value="internal">داخلی</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3 mb-3">
        {!isIncoming && (
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        )}
        <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="normal">عادی</option>
          <option value="urgent">فوری</option>
          <option value="very_urgent">خیلی فوری</option>
        </Select>
        <Select value={issuingEntityId} onChange={(e) => setIssuingEntityId(e.target.value)}>
          <option value="" disabled>شماره‌گذاری: انتخاب شرکت...</option>
          {entities.map((oe) => (
            <option key={oe.id} value={oe.id}>شماره‌گذاری: {oe.entityName}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع نامه" />
        <DualDateInput value={letterDate} onChange={setLetterDate} placeholder="تاریخ نامه" />
      </div>

      {isInternal ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="از بخش">
            <Select value={internalFromDepartmentId} onChange={(e) => setInternalFromDepartmentId(e.target.value)}>
              <option value="">انتخاب بخش مبدأ...</option>
              {departmentsForEntity.map((d) => (
                <option key={d.id} value={d.id}>{d.departmentName}</option>
              ))}
            </Select>
          </Field>
          <Field label="به بخش">
            <Select value={internalToDepartmentId} onChange={(e) => setInternalToDepartmentId(e.target.value)}>
              <option value="">انتخاب بخش مقصد...</option>
              {departmentsForEntity.map((d) => (
                <option key={d.id} value={d.id}>{d.departmentName}</option>
              ))}
            </Select>
          </Field>
          {internalFromDepartmentId && internalFromDepartmentId === internalToDepartmentId && (
            <p className="text-[11px] text-danger sm:col-span-2">بخش مبدأ و مقصد باید متفاوت باشن</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <PartySelector
            label="فرستنده"
            value={sender}
            onChange={setSender}
            ourEntities={entities}
            fixedKind={isIncoming ? "partner" : "our_entity"}
          />
          <PartySelector
            label="گیرنده"
            value={receiver}
            onChange={setReceiver}
            ourEntities={entities}
            fixedKind={isIncoming ? "our_entity" : "partner"}
          />
        </div>
      )}

      {isIncoming && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="شماره نامه فرستنده">
            <TextInput
              value={senderReferenceNumber}
              onChange={(e) => setSenderReferenceNumber(e.target.value)}
              dir="ltr"
              placeholder="شماره‌ای که طرف فرستنده روی نامه گذاشته"
            />
          </Field>
          <Field label="مسئول پیگیری">
            <Select value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}>
              <option value="">انتخاب همکار...</option>
              {(colleagues ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {isOutgoing && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-1.5 text-textPrimary">امضاکننده(های) نامه</p>
          <div className="flex flex-wrap gap-1.5">
            {(colleagues ?? []).map((c) => {
              const checked = signerUserIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSignerUserIds((ids) => (checked ? ids.filter((id) => id !== c.id) : [...ids, c.id]))
                  }
                  className={`text-[11px] px-2.5 py-1 rounded-full ${checked ? "bg-primary text-white" : "bg-bg text-textSecondary"}`}
                >
                  {c.fullName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-3 mb-3 border-t border-dashed border-border">
        <p className="text-[11px] mb-1.5 text-textPrimary">لینک به ...</p>
        <div className="flex gap-1.5 mb-2">
          {[
            { key: "none", label: "بدون لینک" },
            { key: "inquiry", label: "استعلام" },
            { key: "shipment", label: "محموله" },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => { setLinkType(o.key as typeof linkType); setLinkValue(""); }}
              className={`text-[11px] px-2.5 py-1 rounded-full ${linkType === o.key ? "bg-primary text-white" : "bg-bg text-textSecondary"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {linkType === "inquiry" && (
          <Select value={linkValue} onChange={(e) => setLinkValue(e.target.value)} className="sm:!w-64">
            <option value="">انتخاب استعلام...</option>
            {(inquiriesPage?.items ?? []).map((i) => (
              <option key={i.id} value={i.id}>{i.internalNumber} — {i.subject}</option>
            ))}
          </Select>
        )}
        {linkType === "shipment" && (
          <Select value={linkValue} onChange={(e) => setLinkValue(e.target.value)} className="sm:!w-64">
            <option value="">انتخاب محموله...</option>
            {(shipments ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.shipmentNumber}</option>
            ))}
          </Select>
        )}
      </div>

      <Field label="توضیحات (اختیاری)">
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <PrimaryButton
          disabled={!canSubmit || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              const body: SaveLetterBody = {
                type, subject: subject.trim(), letterDate: letterDate!, issuingEntityId, priority,
                relatedInquiryId: linkType === "inquiry" ? linkValue || undefined : undefined,
                relatedShipmentId: linkType === "shipment" ? linkValue || undefined : undefined,
                description: description.trim() || undefined,
                ...(isInternal
                  ? { internalFromDepartmentId, internalToDepartmentId, department }
                  : isIncoming
                    ? { sender, receiver, senderReferenceNumber: senderReferenceNumber.trim(), responsibleUserId }
                    : { sender, receiver, department, signerUserIds }),
              };
              const result = await create.mutateAsync(body);
              onCreated(result.id);
            } catch (err) {
              setError(extractError(err, "خطا در ثبت نامه"));
            }
          }}
        >
          {create.isPending ? "در حال ذخیره..." : "ذخیره پیش‌نویس"}
        </PrimaryButton>
        <GhostButton onClick={onCancel}>انصراف</GhostButton>
      </div>
    </div>
  );
}

export function CorrespondenceListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = hasPermission(user, "correspondence.create");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: letters, isLoading } = useLetters({
    q: query || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    department: deptFilter !== "all" ? deptFilter : undefined,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-medium text-accent mb-1">ماژول سراسری</p>
          <h1 className="text-xl font-bold text-textPrimary">مکاتبات و بایگانی اسناد</h1>
        </div>
        {canCreate && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={15} /> نامه جدید</span>
          </PrimaryButton>
        )}
      </div>
      <p className="text-xs mb-5 text-textSecondary">
        هر واحد فقط نامه‌های مربوط به خودش رو می‌بینه (کنترل دسترسی طبق گروه دسترسی کاربر). شماره نامه فقط بعد از ثبت رسمی صادر می‌شه.
      </p>

      {showNewForm && (
        <NewLetterForm onCancel={() => setShowNewForm(false)} onCreated={(id) => { setShowNewForm(false); navigate(`/correspondence/${id}`); }} />
      )}

      <div className="relative mb-3">
        <Search size={15} className="absolute top-3 right-3 text-textSecondary" />
        <TextInput className="pr-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی موضوع یا شماره نامه..." />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Select className="!w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">همه انواع</option>
          <option value="incoming">دریافتی</option>
          <option value="outgoing">ارسالی</option>
          <option value="internal">داخلی</option>
        </Select>
        <Select className="!w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">همه وضعیت‌ها</option>
          <option value="draft">پیش‌نویس</option>
          <option value="registered">ثبت‌شده</option>
          <option value="sent">ارسال‌شده</option>
          <option value="archived">بایگانی‌شده</option>
        </Select>
        <Select className="!w-auto" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="all">همه واحدها</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <span className="text-[11px] mr-auto self-center text-textSecondary">{letters?.length ?? 0} نامه</span>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {!isLoading && (letters ?? []).length === 0 && (
        <p className="text-sm text-center py-6 text-textSecondary">موردی یافت نشد</p>
      )}

      <div className="space-y-2.5">
        {(letters ?? []).map((l) => {
          const Icon = TYPE_ICON[l.type];
          const typeMeta = TYPE_META[l.type];
          const statusMeta = STATUS_META[l.status];
          const priorityMeta = PRIORITY_META[l.priority];
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => navigate(`/correspondence/${l.id}`)}
              className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3 bg-surface border border-border hover:border-primary transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeMeta.className}`}>
                <Icon size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {l.letterNumber && <span className="font-mono text-xs text-accent" dir="ltr">{l.letterNumber}</span>}
                  <p className="text-sm font-semibold text-textPrimary">{l.subject}</p>
                </div>
                <p className="text-xs text-textSecondary">
                  {formatJalali(l.letterDate)} · {l.department ?? "—"} · {l.documentsCount} سند پیوست
                </p>
              </div>
              <div className="mr-auto flex items-center gap-2">
                {l.priority !== "normal" && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${priorityMeta.className}`}>{priorityMeta.label}</span>
                )}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
