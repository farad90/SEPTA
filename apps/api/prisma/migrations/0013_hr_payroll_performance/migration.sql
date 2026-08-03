-- ============================================================
-- فاز ۲۱ — منابع انسانی (دامنه ۱۱)، زیرفاز D (نهایی): فیش حقوقی + ارزیابی عملکرد
-- عیناً از erp-schema.sql
-- ============================================================

CREATE TABLE payroll_periods (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_entity_id  UUID NOT NULL REFERENCES our_entities(id),
    period_month   INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year    INTEGER NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'finalized', 'paid')),
    finalized_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (our_entity_id, period_month, period_year)
);

CREATE TABLE payslips (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id  UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id        UUID NOT NULL REFERENCES employees(id),
    base_salary        NUMERIC(18,4) NOT NULL,
    total_benefits     NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_overtime     NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_deductions   NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_amount         NUMERIC(18,4) NOT NULL,
    currency_code      VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    file_url           TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'finalized', 'paid')),
    generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

CREATE TABLE payslip_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id   UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    item_type    VARCHAR(10) NOT NULL
                 CHECK (item_type IN ('earning', 'deduction')),
    category     VARCHAR(100) NOT NULL,
    description  VARCHAR(300),
    amount       NUMERIC(18,4) NOT NULL
);

ALTER TABLE employee_loan_installments
    ADD CONSTRAINT fk_loan_installments_payslip
    FOREIGN KEY (deducted_in_payslip_id) REFERENCES payslips(id);

CREATE TABLE performance_review_cycles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_name  VARCHAR(150) NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE performance_reviews (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id           UUID NOT NULL REFERENCES performance_review_cycles(id) ON DELETE CASCADE,
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id        UUID NOT NULL REFERENCES employees(id),
    overall_score      NUMERIC(5,2),
    self_review_notes  TEXT,
    manager_notes      TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'acknowledged')),
    submitted_at       TIMESTAMPTZ,
    acknowledged_at    TIMESTAMPTZ,
    UNIQUE (cycle_id, employee_id)
);

CREATE TABLE performance_review_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
    criterion_name  VARCHAR(150) NOT NULL,
    weight_percent  NUMERIC(5,2),
    score           NUMERIC(5,2),
    comments        TEXT
);
