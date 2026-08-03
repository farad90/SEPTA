-- ============================================================
-- فاز ۳۵-الف — تفکیک توزیع VAT از توزیع سایر هزینه‌ها در قیمت‌گذاری
-- ============================================================

-- ⚠️ distribute_costs جایگزین نمی‌شه (حذف نمی‌شه) — طبق قاعده‌ی Rollback-پذیری پروژه
-- (مثل الگوی shipment_documents در فاز ۲۷)، فقط از این پس نه خونده می‌شه نه نوشته می‌شه.
ALTER TABLE supplier_offers ADD COLUMN distribute_vat BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE supplier_offers ADD COLUMN distribute_other_costs BOOLEAN NOT NULL DEFAULT false;

-- بک‌فیل از ستون قدیمی — رفتار قبلی (یک سوییچ واحد) روی هر دو سوییچ جدید اعمال می‌شه
UPDATE supplier_offers SET distribute_vat = distribute_costs, distribute_other_costs = distribute_costs;
