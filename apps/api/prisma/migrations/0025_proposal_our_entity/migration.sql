-- ============================================================
-- فاز ۳۸ — شرکت گروه صادرکننده پیشنهاد (برای سربرگ سند PDF/Word)
-- Nullable و قفل‌شده در سطح نسخه (هر نسخه‌ی پیشنهاد شرکت صادرکننده‌ی خودش رو نگه می‌داره،
-- دقیقاً هم‌الگوی currency_code/chosen_delivery_term که قبلاً per-version بودن)
-- ============================================================

ALTER TABLE financial_proposals ADD COLUMN our_entity_id UUID REFERENCES our_entities(id);
ALTER TABLE technical_proposals ADD COLUMN our_entity_id UUID REFERENCES our_entities(id);
