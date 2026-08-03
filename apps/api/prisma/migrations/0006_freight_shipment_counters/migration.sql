-- ============================================================
-- فاز ۱۱ — شمارنده‌های اتمیک شماره استعلام حمل (FRT-YYYY-NNNN)
-- و شماره محموله (SHP-YYYY-NNNN) — همون الگوی rfq_counters
-- ============================================================

CREATE TABLE freight_rfq_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shipment_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);
