-- Migration 0030_employee_children — فرزندان با تاریخ تولد، برای اعمال سقف سنی حق اولاد
-- (Rule جداگانه CHILD_ALLOWANCE_MAX_AGE در payroll_rules، نه هاردکد در کد). جایگزین
-- employee_payroll_profiles.children_count که Deprecated شد ولی حذف نشده (Rollback-پذیری).

CREATE TABLE employee_children (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name    VARCHAR(200),
    birth_date   DATE NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_children_employee ON employee_children(employee_id);
