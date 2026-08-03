import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import {
  ManagedUser,
  MODULE_LABEL,
  PermissionGroupSummary,
} from "../../lib/types";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import {
  useGroupMutations,
  usePendingUsers,
  usePermissionCatalog,
  usePermissionGroups,
  useUserMutations,
  useUsers,
} from "./users-api";
import { OutcomeTemplatesTab } from "../activities/OutcomeTemplatesTab";

function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  if (Array.isArray(message)) return message.join("، ");
  return message ?? fallback;
}

// ------------------------------------------------------------
// بخش کاربران در انتظار تأیید
// ------------------------------------------------------------
function PendingUsersSection({ groups }: { groups: PermissionGroupSummary[] }) {
  const { data: pending } = usePendingUsers();
  const { approve } = useUserMutations();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!pending || pending.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning/50 bg-warningSoft p-4 space-y-3">
      <div className="flex items-center gap-2 text-warning">
        <Clock size={15} />
        <p className="text-xs font-bold">{pending.length} درخواست دسترسی در انتظار تأیید</p>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <ul className="space-y-2">
        {pending.map((user) => (
          <li key={user.id} className="flex items-center gap-3 flex-wrap rounded-lg bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-textPrimary">{user.fullName}</p>
              <p className="text-[11px] text-textSecondary">
                {[user.email, user.mobile, user.requestedDepartment ? `واحد درخواستی: ${user.requestedDepartment}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Select
              value={selection[user.id] ?? ""}
              onChange={(e) => setSelection((s) => ({ ...s, [user.id]: e.target.value }))}
              className="w-40 !py-2"
            >
              <option value="" disabled>
                انتخاب گروه دسترسی
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.groupName}
                </option>
              ))}
            </Select>
            <PrimaryButton
              disabled={!selection[user.id] || approve.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await approve.mutateAsync({ userId: user.id, permissionGroupId: selection[user.id] });
                } catch (err) {
                  setError(extractApiError(err, "خطا در تأیید کاربر"));
                }
              }}
            >
              <span className="flex items-center gap-1.5"><Check size={13} /> تأیید</span>
            </PrimaryButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// ساخت سریع کاربر توسط مدیر
// ------------------------------------------------------------
function NewUserQuick({ groups, onDone }: { groups: PermissionGroupSummary[]; onDone: () => void }) {
  const { create } = useUserMutations();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    initialPassword: "",
    permissionGroupId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    form.fullName.trim() && form.email.trim() && form.initialPassword.length >= 8 && form.permissionGroupId;

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">ساخت کاربر جدید</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نام و نام خانوادگی *">
          <TextInput value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="ایمیل *">
          <TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
        </Field>
        <Field label="موبایل">
          <TextInput value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} dir="ltr" placeholder="09121234567" />
        </Field>
        <Field label="گروه دسترسی *">
          <Select
            value={form.permissionGroupId}
            onChange={(e) => setForm({ ...form, permissionGroupId: e.target.value })}
          >
            <option value="" disabled>
              انتخاب گروه
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.groupName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="رمز عبور اولیه * (حداقل ۸ کاراکتر)">
          <TextInput
            type="password"
            value={form.initialPassword}
            onChange={(e) => setForm({ ...form, initialPassword: e.target.value })}
            dir="ltr"
          />
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!canSubmit || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync({
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                mobile: form.mobile.trim() || undefined,
                initialPassword: form.initialPassword,
                permissionGroupId: form.permissionGroupId,
              });
              onDone();
            } catch (err) {
              setError(extractApiError(err, "خطا در ساخت کاربر"));
            }
          }}
        >
          {create.isPending ? "در حال ساخت..." : "ساخت کاربر"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// تب کاربران
// ------------------------------------------------------------
function UsersTab({ groups }: { groups: PermissionGroupSummary[] }) {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const { update, resetPassword } = useUserMutations();
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState("");
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <PendingUsersSection groups={groups} />

      <div className="flex justify-end">
        {!showNewUser && (
          <PrimaryButton onClick={() => setShowNewUser(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> کاربر جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewUser && <NewUserQuick groups={groups} onDone={() => setShowNewUser(false)} />}
      {error && <p className="text-xs text-danger">{error}</p>}
      {successMessage && <p className="text-xs text-success">{successMessage}</p>}
      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {(users ?? []).map((user: ManagedUser) => {
          const isSelf = user.id === currentUser?.id;
          const isEditing = editingUserId === user.id;
          const isResetting = resettingUserId === user.id;
          return (
            <div key={user.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-full bg-bg text-textSecondary flex items-center justify-center shrink-0">
                <UserRound size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary">
                  {user.fullName}
                  {isSelf && <span className="text-[10px] text-textSecondary mr-1.5">(خودتان)</span>}
                </p>
                <p className="text-[11px] text-textSecondary truncate">
                  {[user.email, user.mobile].filter(Boolean).join(" · ")}
                </p>
              </div>

              {isResetting ? (
                <>
                  <TextInput
                    type="password"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                    dir="ltr"
                    className="w-56 !py-2"
                    autoFocus
                  />
                  <GhostButton
                    onClick={() => {
                      setResettingUserId(null);
                      setNewPasswordValue("");
                    }}
                  >
                    انصراف
                  </GhostButton>
                  <PrimaryButton
                    disabled={newPasswordValue.length < 8 || resetPassword.isPending}
                    onClick={async () => {
                      try {
                        setError(null);
                        setSuccessMessage(null);
                        await resetPassword.mutateAsync({ userId: user.id, newPassword: newPasswordValue });
                        setResettingUserId(null);
                        setNewPasswordValue("");
                        setSuccessMessage(`رمز عبور «${user.fullName}» با موفقیت بازنشانی شد.`);
                      } catch (err) {
                        setError(extractApiError(err, "خطا در بازنشانی رمز عبور"));
                      }
                    }}
                  >
                    {resetPassword.isPending ? "در حال ثبت..." : "بازنشانی"}
                  </PrimaryButton>
                </>
              ) : isEditing ? (
                <>
                  <Select value={editGroupId} onChange={(e) => setEditGroupId(e.target.value)} className="w-40 !py-2">
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.groupName}
                      </option>
                    ))}
                  </Select>
                  <GhostButton onClick={() => setEditingUserId(null)}>انصراف</GhostButton>
                  <PrimaryButton
                    disabled={update.isPending}
                    onClick={async () => {
                      try {
                        setError(null);
                        await update.mutateAsync({ userId: user.id, permissionGroupId: editGroupId });
                        setEditingUserId(null);
                      } catch (err) {
                        setError(extractApiError(err, "خطا در تغییر گروه"));
                      }
                    }}
                  >
                    ذخیره
                  </PrimaryButton>
                </>
              ) : (
                <>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-accentSoft text-accent font-medium shrink-0">
                    {user.permissionGroup?.groupName ?? "—"}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      user.status === "active" ? "bg-successSoft text-success" : "bg-border text-textSecondary"
                    }`}
                  >
                    {user.status === "active" ? "فعال" : "غیرفعال"}
                  </span>
                  {!isSelf && (
                    <>
                      <button
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditGroupId(user.permissionGroupId ?? "");
                        }}
                        className="text-textSecondary"
                        aria-label="تغییر گروه"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setSuccessMessage(null);
                          setResettingUserId(user.id);
                          setNewPasswordValue("");
                        }}
                        className="text-textSecondary"
                        aria-label="بازنشانی رمز عبور"
                        title="بازنشانی رمز عبور"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setError(null);
                            await update.mutateAsync({
                              userId: user.id,
                              status: user.status === "active" ? "inactive" : "active",
                            });
                          } catch (err) {
                            setError(extractApiError(err, "خطا در تغییر وضعیت"));
                          }
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border ${
                          user.status === "active"
                            ? "text-danger border-danger/40"
                            : "text-success border-success/40"
                        }`}
                      >
                        {user.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// جزئیات/ویرایش گروه — چک‌باکس‌های دسترسی گروه‌بندی‌شده بر اساس ماژول
// ------------------------------------------------------------
function GroupDetail({
  group,
  onBack,
}: {
  group: PermissionGroupSummary;
  onBack: () => void;
}) {
  const { user: currentUser } = useAuth();
  const isOwnGroup = currentUser?.permissionGroup === group.groupName;
  const { data: catalog } = usePermissionCatalog();
  const { update, remove } = useGroupMutations();

  const [name, setName] = useState(group.groupName);
  const [keys, setKeys] = useState<Set<string>>(new Set(group.permissionKeys));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const canDelete = !group.isDefault && group.memberCount === 0 && !isOwnGroup;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به گروه‌ها
      </button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0 flex-1">
            {group.isDefault ? (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-textPrimary">{group.groupName}</h2>
                <span className="flex items-center gap-1 text-[10px] text-textSecondary">
                  <Lock size={11} /> گروه پیش‌فرض — نام قابل تغییر نیست
                </span>
              </div>
            ) : (
              <TextInput value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
            )}
            <p className="text-[11px] text-textSecondary mt-1">{group.memberCount} عضو</p>
          </div>
          {canDelete && (
            <button onClick={() => setConfirmDelete(true)} className="text-xs px-3 py-2 rounded-lg text-danger border border-danger/40">
              <span className="flex items-center gap-1.5"><Trash2 size={13} /> حذف گروه</span>
            </button>
          )}
        </div>

        {isOwnGroup && (
          <p className="text-xs rounded-lg p-3 bg-warningSoft text-warning">
            این گروه دسترسی خودته — برای جلوگیری از سلب دسترسی خودت، قابل ویرایش نیست.
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="space-y-4">
          {(catalog ?? []).map((moduleGroup) => (
            <div key={moduleGroup.module}>
              <p className="text-xs font-bold text-textPrimary mb-2">
                {MODULE_LABEL[moduleGroup.module] ?? moduleGroup.module}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {moduleGroup.items.map((permission) => (
                  <label
                    key={permission.permissionKey}
                    className={`flex items-center gap-2 text-xs text-textPrimary ${
                      isOwnGroup ? "opacity-60" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5"
                      disabled={isOwnGroup}
                      checked={keys.has(permission.permissionKey)}
                      onChange={() => toggle(permission.permissionKey)}
                    />
                    {permission.permissionLabel}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!isOwnGroup && (
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={onBack}>انصراف</GhostButton>
            <PrimaryButton
              disabled={update.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await update.mutateAsync({
                    id: group.id,
                    groupName: group.isDefault ? undefined : name.trim(),
                    permissionKeys: [...keys],
                  });
                  onBack();
                } catch (err) {
                  setError(extractApiError(err, "خطا در ذخیره گروه"));
                }
              }}
            >
              {update.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </PrimaryButton>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف گروه «${group.groupName}»`}
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(group.id);
              setConfirmDelete(false);
              onBack();
            } catch (err) {
              setConfirmDelete(false);
              setError(extractApiError(err, "خطا در حذف گروه"));
            }
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// تب گروه‌های دسترسی
// ------------------------------------------------------------
function GroupsTab({ groups }: { groups: PermissionGroupSummary[] }) {
  const { create } = useGroupMutations();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = groups.find((group) => group.id === selectedGroupId) ?? null;
  if (selected) {
    return <GroupDetail group={selected} onBack={() => setSelectedGroupId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!creating && (
          <PrimaryButton onClick={() => setCreating(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> گروه سفارشی جدید</span>
          </PrimaryButton>
        )}
      </div>

      {creating && (
        <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
          <Field label="نام گروه *">
            <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثلاً کارشناس ارشد بازرگانی" />
          </Field>
          {error && <p className="text-xs text-danger">{error}</p>}
          <p className="text-[11px] text-textSecondary">
            گروه با دسترسی خالی ساخته می‌شه؛ بعد از ساخت، چک‌باکس‌های دسترسی رو از صفحه جزئیاتش تیک بزن.
          </p>
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setCreating(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!newName.trim() || create.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  const created = await create.mutateAsync({ groupName: newName.trim(), permissionKeys: [] });
                  setCreating(false);
                  setNewName("");
                  setSelectedGroupId(created.id);
                } catch (err) {
                  setError(extractApiError(err, "خطا در ساخت گروه"));
                }
              }}
            >
              {create.isPending ? "در حال ساخت..." : "ساخت گروه"}
            </PrimaryButton>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
              <ShieldCheck size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-textPrimary">
                {group.groupName}
                {group.isDefault && (
                  <span className="text-[10px] text-textSecondary mr-1.5">(پیش‌فرض)</span>
                )}
              </p>
              <p className="text-[11px] text-textSecondary">
                {group.permissionKeys.length} دسترسی فعال · {group.memberCount} عضو
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function UsersPage() {
  const [tab, setTab] = useState<"users" | "groups" | "outcomeTemplates">("users");
  const { data: groups, isLoading, isError } = usePermissionGroups();

  if (isLoading) {
    return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;
  }
  if (isError) {
    return (
      <p className="text-xs text-danger py-8 text-center">
        خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        {(
          [
            ["users", "کاربران"],
            ["groups", "گروه‌های دسترسی"],
            ["outcomeTemplates", "قالب‌های نتیجه فعالیت"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-medium ${
              tab === key ? "bg-primary text-white" : "bg-surface text-textSecondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab groups={groups ?? []} />}
      {tab === "groups" && <GroupsTab groups={groups ?? []} />}
      {tab === "outcomeTemplates" && <OutcomeTemplatesTab />}
    </div>
  );
}
