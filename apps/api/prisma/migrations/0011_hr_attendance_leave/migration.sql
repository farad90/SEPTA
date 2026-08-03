-- ============================================================
-- فاز ۱۹ — منابع انسانی (دامنه ۱۱)، زیرفاز B: حضور و غیاب + مرخصی + مأموریت + اضافه‌کاری
-- عیناً از erp-schema.sql
-- ============================================================

CREATE TABLE attendance_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date    DATE NOT NULL,
    check_in_time                TIMESTAMPTZ,
    check_out_time                TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'present'
                 CHECK (status IN ('present', 'absent', 'on_leave', 'holiday', 'mission')),
    source       VARCHAR(20) NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('device', 'manual')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, work_date)
);

CREATE TABLE leave_types (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name                VARCHAR(100) NOT NULL,
    is_paid                  BOOLEAN NOT NULL DEFAULT true,
    annual_entitlement_days  NUMERIC(5,1)
);

CREATE TABLE leave_balances (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id  UUID NOT NULL REFERENCES leave_types(id),
    year           INTEGER NOT NULL,
    entitled_days  NUMERIC(5,1) NOT NULL,
    used_days      NUMERIC(5,1) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id        UUID NOT NULL REFERENCES leave_types(id),
    start_date           DATE NOT NULL,
    end_date             DATE NOT NULL,
    days_count           NUMERIC(5,1) NOT NULL,
    reason               TEXT,
    attachment_file_url  TEXT,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approver_id          UUID REFERENCES employees(id),
    approved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mission_requests (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    destination                 VARCHAR(200) NOT NULL,
    purpose                     TEXT,
    start_date                  DATE NOT NULL,
    end_date                    DATE NOT NULL,
    transportation_method       VARCHAR(50),
    estimated_cost              NUMERIC(18,4),
    currency_code               VARCHAR(3) REFERENCES currencies(currency_code),
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    approver_id                 UUID REFERENCES employees(id),
    approved_at                 TIMESTAMPTZ,
    related_expense_request_id  UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE overtime_records (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date          DATE NOT NULL,
    hours              NUMERIC(5,2) NOT NULL,
    reason             TEXT,
    rate_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.4,
    calculated_amount  NUMERIC(18,4),
    currency_code      VARCHAR(3) REFERENCES currencies(currency_code),
    status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    approver_id        UUID REFERENCES employees(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
