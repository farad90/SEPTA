import { useState } from "react";
import { Search } from "lucide-react";
import { Field, Select, TextInput } from "../../components/ui/fields";
import { useDebounced } from "../../lib/use-debounced";
import { PARTNER_TYPE_LABEL } from "../../lib/types";
import { usePartners } from "../partners/partners-api";
import { LetterPartyBody } from "./correspondence-api";

export interface OurEntityOption {
  id: string;
  entityName: string;
}

export function PartySelector({
  label,
  value,
  onChange,
  ourEntities,
  fixedKind,
}: {
  label: string;
  value: LetterPartyBody;
  onChange: (party: LetterPartyBody) => void;
  ourEntities: OurEntityOption[];
  /** وقتی ست بشه (طبق جهت نامه)، Toggle انتخاب حذف می‌شه و فقط همون حالت نشون داده می‌شه */
  fixedKind?: "our_entity" | "partner";
}) {
  const kind: "our" | "partner" = fixedKind
    ? fixedKind === "our_entity"
      ? "our"
      : "partner"
    : value.ourEntityId
      ? "our"
      : "partner";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const debouncedQuery = useDebounced(query, 300);
  const { data } = usePartners(debouncedQuery, "all");
  const options = (data?.items ?? []).slice(0, 8);
  const chosenPartner = value.partnerId ? (data?.items ?? []).find((p) => p.id === value.partnerId) : undefined;

  return (
    <div>
      <Field label={label}>
        {!fixedKind && (
          <div className="flex gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => onChange({ ourEntityId: ourEntities[0]?.id })}
              className={`text-[11px] px-2.5 py-1 rounded-full ${kind === "our" ? "bg-primary text-white" : "bg-bg text-textSecondary"}`}
            >
              یکی از شرکت‌های ما
            </button>
            <button
              type="button"
              onClick={() => onChange({})}
              className={`text-[11px] px-2.5 py-1 rounded-full ${kind === "partner" ? "bg-primary text-white" : "bg-bg text-textSecondary"}`}
            >
              طرف بیرونی (از قبل تعریف‌شده)
            </button>
          </div>
        )}

        {kind === "our" ? (
          <Select value={value.ourEntityId ?? ""} onChange={(e) => onChange({ ourEntityId: e.target.value })}>
            <option value="" disabled>انتخاب شرکت گروه...</option>
            {ourEntities.map((oe) => (
              <option key={oe.id} value={oe.id}>{oe.entityName}</option>
            ))}
          </Select>
        ) : (
          <div>
            <div className="relative">
              <Search size={14} className="absolute top-3 right-3 text-textSecondary" />
              <TextInput
                className="pr-9"
                placeholder="جست‌وجوی نام شرکت (مشتری/تأمین‌کننده/سازمان/بانک/...)..."
                value={chosenPartner?.companyName ?? query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  onChange({});
                }}
                onFocus={() => setOpen(true)}
              />
              {open && !chosenPartner && query.trim().length >= 1 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg border border-border bg-surface shadow-lg max-h-44 overflow-y-auto">
                  {options.length === 0 && <p className="text-xs px-3 py-2 text-textSecondary">شرکتی یافت نشد</p>}
                  {options.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onChange({ partnerId: p.id });
                        setQuery("");
                        setOpen(false);
                      }}
                      className="w-full text-right text-sm px-3 py-2 hover:bg-bg text-textPrimary"
                    >
                      {p.companyName} <span className="text-[11px] text-textSecondary">— {PARTNER_TYPE_LABEL[p.partnerType]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {chosenPartner && chosenPartner.contacts.length > 0 && (
              <Select
                className="mt-1.5"
                value={value.contactId ?? ""}
                onChange={(e) => onChange({ ...value, contactId: e.target.value || undefined })}
              >
                <option value="">رابط مشخص (اختیاری)</option>
                {chosenPartner.contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contactName}</option>
                ))}
              </Select>
            )}
          </div>
        )}
      </Field>
    </div>
  );
}
