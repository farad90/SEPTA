-- Migration 0038_financial_proposal_commercial_terms — بازخورد کاربر بعد از دیدن نمونه
-- "Sales Order Confirmation" یک شرکت مشابه (Bitax Group): چند فیلد تجاری/خدماتی که سند
-- پیشنهاد مالی ما نداشت. همه روی financial_proposals (نه technical_proposals) چون این‌ها
-- مفاهیم تجاری/سند فروش هستن، نه مشخصات فنی. Rollback: DROP COLUMN های زیر.

ALTER TABLE financial_proposals ADD COLUMN payment_method VARCHAR(50);
ALTER TABLE financial_proposals ADD COLUMN partial_shipment_allowed BOOLEAN NOT NULL DEFAULT true;

-- چک‌لیست مدارک ارسالی همراه محموله — آرایه‌ای از کلیدهای ثابت (کپی اینویس، پکینگ‌لیست، ...)
ALTER TABLE financial_proposals ADD COLUMN documents_checklist TEXT[] NOT NULL DEFAULT '{}';

-- جدول Test/Field Service/Design/Warranty نمونه مرجع — هرکدوم یک فیلد کوتاه (N/A، Included، Excluded و...)
ALTER TABLE financial_proposals ADD COLUMN service_test VARCHAR(100);
ALTER TABLE financial_proposals ADD COLUMN service_field_service VARCHAR(100);
ALTER TABLE financial_proposals ADD COLUMN service_design VARCHAR(100);
ALTER TABLE financial_proposals ADD COLUMN warranty_terms TEXT;

-- ⚠️ عمداً جدا از negotiation_note (که یادداشت داخلی مذاکره‌ست، مشتری نمی‌بینتش) —
-- این فیلد متن آزاد مستقیماً در سند نمایش داده می‌شه، هم‌الگوی «Remark» نمونه مرجع
ALTER TABLE financial_proposals ADD COLUMN remarks TEXT;
