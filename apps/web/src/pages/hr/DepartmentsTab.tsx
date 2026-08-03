import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { useOurEntities } from "../inquiries/rfqs-api";
import { useDepartmentMutations, useDepartments, useEmployees } from "./hr-api";
import { Department } from "./hr-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

interface DeptNode extends Department {
  children: DeptNode[];
}

function buildTree(departments: Department[]): DeptNode[] {
  const nodes = new Map<string, DeptNode>(departments.map((d) => [d.id, { ...d, children: [] }]));
  const roots: DeptNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentDepartmentId && nodes.has(node.parentDepartmentId)) {
      nodes.get(node.parentDepartmentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function NewDepartmentForm({ onDone }: { onDone: () => void }) {
  const { data: ourEntities } = useOurEntities();
  const { data: departments } = useDepartments();
  const { create } = useDepartmentMutations();
  const [departmentName, setDepartmentName] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");
  const [ourEntityId, setOurEntityId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">بخش جدید</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="نام بخش *">
          <TextInput value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} />
        </Field>
        <Field label="بخش والد">
          <Select value={parentDepartmentId} onChange={(e) => setParentDepartmentId(e.target.value)}>
            <option value="">— بدون والد —</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.departmentName}</option>
            ))}
          </Select>
        </Field>
        <Field label="شرکت گروه *">
          <Select value={ourEntityId} onChange={(e) => setOurEntityId(e.target.value)}>
            <option value="">— انتخاب —</option>
            {(ourEntities ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.entityName}</option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!departmentName.trim() || !ourEntityId || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync({
                departmentName: departmentName.trim(),
                parentDepartmentId: parentDepartmentId || undefined,
                ourEntityId,
              });
              onDone();
            } catch (err) {
              setError(extractError(err, "خطا در ثبت بخش"));
            }
          }}
        >
          {create.isPending ? "در حال ثبت..." : "ثبت بخش"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function EditDepartmentForm({ department, onDone }: { department: Department; onDone: () => void }) {
  const { data: departments } = useDepartments();
  const { data: deptEmployeesRaw } = useEmployees({ departmentId: department.id });
  const deptEmployees = useMemo(() => (deptEmployeesRaw ?? []).filter((e) => e.employeeNumber), [deptEmployeesRaw]);
  const { update } = useDepartmentMutations();
  const [departmentName, setDepartmentName] = useState(department.departmentName);
  const [parentDepartmentId, setParentDepartmentId] = useState(department.parentDepartmentId ?? "");
  const [status, setStatus] = useState(department.status);
  const [headEmployeeId, setHeadEmployeeId] = useState(department.headEmployeeId ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">ویرایش بخش</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نام بخش *">
          <TextInput value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} />
        </Field>
        <Field label="بخش والد">
          <Select value={parentDepartmentId} onChange={(e) => setParentDepartmentId(e.target.value)}>
            <option value="">— بدون والد —</option>
            {(departments ?? [])
              .filter((d) => d.id !== department.id)
              .map((d) => (
                <option key={d.id} value={d.id}>{d.departmentName}</option>
              ))}
          </Select>
        </Field>
        <Field label="وضعیت">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Department["status"])}>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </Select>
        </Field>
        <Field label="سرپرست بخش">
          <Select value={headEmployeeId} onChange={(e) => setHeadEmployeeId(e.target.value)}>
            <option value="">— تعیین نشده —</option>
            {(deptEmployees ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.fullName}</option>
            ))}
          </Select>
          {(deptEmployees ?? []).length === 0 && (
            <p className="text-[11px] text-textSecondary mt-1">
              فقط پرسنلی که عضو همین بخش‌اند قابل انتخاب به‌عنوان سرپرست‌اند.
            </p>
          )}
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!departmentName.trim() || update.isPending}
          onClick={async () => {
            try {
              setError(null);
              await update.mutateAsync({
                id: department.id,
                departmentName: departmentName.trim(),
                parentDepartmentId: parentDepartmentId || null,
                status,
                headEmployeeId: headEmployeeId || null,
              });
              onDone();
            } catch (err) {
              setError(extractError(err, "خطا در ذخیره بخش"));
            }
          }}
        >
          {update.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function DeptRow({
  node,
  depth,
  canEdit,
  onEdit,
  onDelete,
}: {
  node: DeptNode;
  depth: number;
  canEdit: boolean;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 p-4" style={{ paddingRight: `${1 + depth * 1.5}rem` }}>
        <div className="w-8 h-8 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
          <Building2 size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-textPrimary truncate">{node.departmentName}</p>
          <p className="text-[11px] text-textSecondary truncate">
            {node.ourEntity.entityName}
            {node.headEmployee ? ` · سرپرست: ${node.headEmployee.fullName}` : ""}
            {node._count ? ` · ${node._count.employees} نفر` : ""}
          </p>
        </div>
        {node.status === "inactive" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-border text-textSecondary">غیرفعال</span>
        )}
        {canEdit && (
          <>
            <button onClick={() => onEdit(node)} className="text-textSecondary" aria-label="ویرایش بخش">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(node)} className="text-danger" aria-label="حذف بخش">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      {node.children.map((child) => (
        <DeptRow key={child.id} node={child} depth={depth + 1} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

export function DepartmentsTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");
  const { data, isLoading, isError } = useDepartments();
  const { remove } = useDepartmentMutations();
  const [showNewForm, setShowNewForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(data ?? []), [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> بخش جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && <NewDepartmentForm onDone={() => setShowNewForm(false)} />}
      {editing && <EditDepartmentForm department={editing} onDone={() => setEditing(null)} />}
      {deleteError && <p className="text-xs text-danger">{deleteError}</p>}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {tree.length === 0 && <p className="text-xs text-textSecondary p-8 text-center">هنوز بخشی ثبت نشده.</p>}
          {tree.map((node) => (
            <DeptRow
              key={node.id}
              node={node}
              depth={0}
              canEdit={canManage}
              onEdit={setEditing}
              onDelete={(d) => {
                setDeleteError(null);
                setDeleting(d);
              }}
            />
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title={`حذف بخش «${deleting.departmentName}»`}
          description="اگه این بخش پرسنل یا بخش زیرمجموعه داشته باشه، حذف امکان‌پذیر نیست — به‌جاش می‌تونید وضعیتش رو «غیرفعال» کنید."
          busy={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(deleting.id);
              setDeleting(null);
            } catch (err) {
              setDeleting(null);
              setDeleteError(extractError(err, "خطا در حذف بخش"));
            }
          }}
        />
      )}
    </div>
  );
}
