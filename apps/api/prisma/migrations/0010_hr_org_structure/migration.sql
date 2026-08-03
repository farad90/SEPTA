-- ============================================================
-- فاز ۱۸ — منابع انسانی (دامنه ۱۱)، زیرفاز A: ساختار سازمانی + پروندهٔ پرسنل
-- عیناً از erp-schema.sql (بخش «ساختار سازمانی و پرونده پرسنل»)
-- ============================================================

CREATE TABLE departments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name       VARCHAR(200) NOT NULL,
    parent_department_id  UUID REFERENCES departments(id),
    our_entity_id         UUID NOT NULL REFERENCES our_entities(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID REFERENCES users(id),
    employee_number          VARCHAR(30) UNIQUE NOT NULL,
    full_name                VARCHAR(200) NOT NULL,
    national_id              VARCHAR(20),
    birth_date               DATE,
    gender                   VARCHAR(10) CHECK (gender IN ('male', 'female')),
    mobile                   VARCHAR(30),
    email                    VARCHAR(200),
    address                  TEXT,
    marital_status           VARCHAR(20) CHECK (marital_status IN ('single', 'married')),
    military_service_status  VARCHAR(30)
                                  CHECK (military_service_status IN
                                  ('completed', 'exempt', 'in_progress', 'not_applicable')),
    education_level          VARCHAR(30),
    profile_photo_url        TEXT,
    bank_account_number      VARCHAR(50),
    bank_name                VARCHAR(100),
    emergency_contact_name   VARCHAR(200),
    emergency_contact_phone  VARCHAR(30),
    department_id            UUID REFERENCES departments(id),
    position_title           VARCHAR(150),
    direct_manager_id        UUID REFERENCES employees(id),
    our_entity_id            UUID NOT NULL REFERENCES our_entities(id),
    hire_date                DATE NOT NULL,
    termination_date         DATE,
    employment_status        VARCHAR(20) NOT NULL DEFAULT 'active'
                                  CHECK (employment_status IN ('active', 'on_leave', 'terminated')),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE departments
    ADD COLUMN head_employee_id UUID REFERENCES employees(id);

CREATE INDEX idx_employees_full_name ON employees USING gin (full_name gin_trgm_ops);

CREATE TABLE employee_contracts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    our_entity_id    UUID NOT NULL REFERENCES our_entities(id),
    contract_type    VARCHAR(20) NOT NULL
                          CHECK (contract_type IN ('permanent', 'fixed_term', 'project_based', 'probation')),
    position_title   VARCHAR(150),
    start_date       DATE NOT NULL,
    end_date         DATE,
    base_salary      NUMERIC(18,4) NOT NULL,
    salary_currency  VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    work_location    VARCHAR(200),
    status           VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'expired', 'terminated')),
    file_url         TEXT,
    signed_date      DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
