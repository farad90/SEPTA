-- Migration 0028_payroll_engine_foundation (فاز ۴۱-الف)
-- دامنه ۱۲: موتور حقوق و دستمزد قانون‌محور (Payroll Engine)
-- افزودنی محض — هیچ جدول/ستون موجودی تغییر یا حذف نمی‌شود.
-- جداول payroll_periods/payslips/payslip_items قدیمی دست‌نخورده باقی می‌مانند
-- (فقط در Prisma به LegacyPayrollPeriod/LegacyPayslip/LegacyPayslipItem تغییر نام دادند — بدون اثر روی DB).

CREATE TABLE payroll_years (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_number  INTEGER NOT NULL UNIQUE,
    calendar_type VARCHAR(10) NOT NULL DEFAULT 'jalali'
                    CHECK (calendar_type IN ('jalali', 'gregorian')),
    status       VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll_rule_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_year_id UUID NOT NULL REFERENCES payroll_years(id),
    version_number  INTEGER NOT NULL,
    title           VARCHAR(200) NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'superseded')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_year_id, version_number)
);

CREATE TABLE payroll_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    title           VARCHAR(300) NOT NULL,
    value_type      VARCHAR(20) NOT NULL
                        CHECK (value_type IN ('number', 'percent', 'boolean')),
    value           NUMERIC(18,4) NOT NULL,
    effective_date  DATE NOT NULL,
    expire_date     DATE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_version_id, code)
);

-- پله‌های مالیات پلکانی — ذاتاً چندردیفی، در قالب payroll_rules تک‌مقداره جا نمی‌شود
CREATE TABLE payroll_tax_brackets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id) ON DELETE CASCADE,
    bracket_order   INTEGER NOT NULL,
    from_amount     NUMERIC(18,4) NOT NULL,
    to_amount       NUMERIC(18,4),
    rate_percent    NUMERIC(5,2) NOT NULL,
    UNIQUE (rule_version_id, bracket_order)
);

CREATE TABLE payroll_formulas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    expression      TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_version_id, code)
);

CREATE TABLE payroll_components (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(50) NOT NULL UNIQUE,
    title          VARCHAR(200) NOT NULL,
    component_type VARCHAR(10) NOT NULL
                        CHECK (component_type IN ('earning', 'deduction')),
    is_insurable   BOOLEAN NOT NULL DEFAULT false,
    is_taxable     BOOLEAN NOT NULL DEFAULT false,
    calc_order     INTEGER NOT NULL DEFAULT 0,
    formula_id     UUID REFERENCES payroll_formulas(id),
    status         VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- عمداً باریک — حقوق پایه/نوع قرارداد از employee_contracts، تأهل از employees خوانده می‌شود
CREATE TABLE employee_payroll_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id             UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    seniority_base_date     DATE,
    children_count          INTEGER NOT NULL DEFAULT 0,
    insurance_number        VARCHAR(50),
    cost_center_dept_id     UUID REFERENCES departments(id),
    default_rule_version_id UUID REFERENCES payroll_rule_versions(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ⚠️ نام‌گذاری متفاوت از جدول قدیمی payroll_periods (اکنون LegacyPayrollPeriod در Prisma)
CREATE TABLE payroll_periods_v2 (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_year_id UUID NOT NULL REFERENCES payroll_years(id),
    period_code     VARCHAR(10) NOT NULL UNIQUE,
    month_number    INTEGER NOT NULL,
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snapshot تجمیعی خودکار از attendance_records/leave_requests/overtime_records/mission_requests
-- با قابلیت اصلاح دستی برای موارد استثنا (source='manual')
CREATE TABLE payroll_work_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id   UUID NOT NULL REFERENCES payroll_periods_v2(id) ON DELETE CASCADE,
    employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    worked_days         NUMERIC(5,2) NOT NULL DEFAULT 0,
    overtime_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
    night_hours         NUMERIC(6,2) NOT NULL DEFAULT 0,
    friday_hours        NUMERIC(6,2) NOT NULL DEFAULT 0,
    holiday_hours       NUMERIC(6,2) NOT NULL DEFAULT 0,
    mission_days        NUMERIC(5,2) NOT NULL DEFAULT 0,
    leave_days          NUMERIC(5,2) NOT NULL DEFAULT 0,
    absence_days        NUMERIC(5,2) NOT NULL DEFAULT 0,
    lateness_minutes    INTEGER NOT NULL DEFAULT 0,
    early_leave_minutes INTEGER NOT NULL DEFAULT 0,
    required_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
    worked_hours        NUMERIC(6,2) NOT NULL DEFAULT 0,
    source              VARCHAR(20) NOT NULL DEFAULT 'auto_aggregated'
                            CHECK (source IN ('auto_aggregated', 'manual')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

CREATE TABLE payroll_results (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id         UUID NOT NULL REFERENCES payroll_periods_v2(id),
    employee_id               UUID NOT NULL REFERENCES employees(id),
    status                    VARCHAR(20) NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'calculated', 'reviewed', 'approved', 'posted', 'locked')),
    gross_earnings            NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_deductions          NUMERIC(18,4) NOT NULL DEFAULT 0,
    insurance_employee_share  NUMERIC(18,4) NOT NULL DEFAULT 0,
    insurance_employer_share  NUMERIC(18,4) NOT NULL DEFAULT 0,
    unemployment_insurance    NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount                NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_salary                NUMERIC(18,4) NOT NULL DEFAULT 0,
    employer_cost             NUMERIC(18,4) NOT NULL DEFAULT 0,
    calculated_at             TIMESTAMPTZ,
    calculated_by             UUID REFERENCES users(id),
    reviewed_at               TIMESTAMPTZ,
    reviewed_by               UUID REFERENCES users(id),
    approved_at               TIMESTAMPTZ,
    approved_by               UUID REFERENCES users(id),
    posted_at                 TIMESTAMPTZ,
    posted_by                 UUID REFERENCES users(id),
    locked_at                 TIMESTAMPTZ,
    locked_by                 UUID REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

-- هر ردیف یک Snapshot است — حتی اگر بعداً عنوان Component یا متن فرمول عوض شود، تاریخچه دست‌نخورده می‌ماند
CREATE TABLE payroll_result_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_result_id  UUID NOT NULL REFERENCES payroll_results(id) ON DELETE CASCADE,
    component_id       UUID NOT NULL REFERENCES payroll_components(id),
    component_code     VARCHAR(50) NOT NULL,
    amount             NUMERIC(18,4) NOT NULL,
    calc_order         INTEGER NOT NULL,
    formula_snapshot   TEXT
);

CREATE TABLE payroll_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     UUID NOT NULL,
    action        VARCHAR(20) NOT NULL
                      CHECK (action IN ('created', 'updated', 'deleted', 'status_changed')),
    field_name    VARCHAR(100),
    old_value     TEXT,
    new_value     TEXT,
    performed_by  UUID NOT NULL REFERENCES users(id),
    performed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_audit_log_entity ON payroll_audit_log(entity_type, entity_id);
