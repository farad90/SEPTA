-- فاز ۴۰-ب — شمارنده اتمیک شماره پیشنهاد مالی/فنی بر مبنای شرکت گروه صادرکننده (پ ت الگوی letter_counters)
-- تا شماره پیشنهاد در آینده قابل ردیابی به شرکت صادرکننده‌ش باشه، نه فقط شماره داخلی پرونده
CREATE TABLE proposal_counters (
    year            INTEGER NOT NULL,
    our_entity_id   UUID NOT NULL REFERENCES our_entities(id),
    last_serial     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, our_entity_id)
);
