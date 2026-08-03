-- ============================================================
-- فاز ۴ — شمارنده اتمیک شماره RFQ (RFQ-YYYY-NNNN، سال میلادی)
-- همون الگوی inquiry_counters؛ تولید شماره در تراکنش با SELECT ... FOR UPDATE
-- ============================================================

CREATE TABLE rfq_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);
