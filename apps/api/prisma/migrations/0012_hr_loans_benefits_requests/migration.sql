-- ============================================================
-- فاز ۲۰ — منابع انسانی (دامنه ۱۱)، زیرفاز C: وام + مزایا/کسورات + درخواست‌های عمومی
-- عیناً از erp-schema.sql
-- ============================================================

CREATE TABLE employee_loans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_amount           NUMERIC(18,4) NOT NULL,
    currency_code         VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    request_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    reason                TEXT,
    installment_count     INTEGER NOT NULL,
    monthly_installment   NUMERIC(18,4) NOT NULL,
    start_deduction_date  DATE,
    status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'active', 'settled', 'rejected')),
    approver_id           UUID REFERENCES employees(id),
    approved_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_loan_installments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id                 UUID NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
    installment_number      INTEGER NOT NULL,
    due_date                DATE NOT NULL,
    amount                  NUMERIC(18,4) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'deducted')),
    deducted_in_payslip_id  UUID,
    UNIQUE (loan_id, installment_number)
);

CREATE TABLE benefit_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_name          VARCHAR(150) NOT NULL,
    is_recurring_default  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE employee_benefits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_type_id  UUID NOT NULL REFERENCES benefit_types(id),
    amount           NUMERIC(18,4) NOT NULL,
    currency_code    VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    effective_from   DATE NOT NULL,
    effective_to     DATE,
    is_recurring     BOOLEAN NOT NULL DEFAULT true,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deduction_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_name        VARCHAR(150) NOT NULL,
    is_recurring_default  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE employee_deductions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    deduction_type_id  UUID NOT NULL REFERENCES deduction_types(id),
    amount             NUMERIC(18,4) NOT NULL,
    currency_code      VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    effective_from     DATE NOT NULL,
    effective_to       DATE,
    is_recurring       BOOLEAN NOT NULL DEFAULT true,
    related_loan_id    UUID REFERENCES employee_loans(id),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_type         VARCHAR(30) NOT NULL
                         CHECK (request_type IN ('certificate', 'salary_advance', 'equipment', 'other')),
    description          TEXT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    approver_id          UUID REFERENCES employees(id),
    related_entity_type  VARCHAR(30),
    related_entity_id    UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
