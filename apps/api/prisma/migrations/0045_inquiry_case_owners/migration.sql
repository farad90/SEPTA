-- Migration 0045_inquiry_case_owners — مالکان پرونده (Case Owners) و تگ مرحلهٔ Activity
-- طبق SEPTA ERP Inquiry Workflow & Ownership Architecture v1.0 (تأییدشده).
-- کاملاً افزودنی — هیچ جدول/ستون موجودی تغییر یا حذف نمی‌شه.

-- Sales Owner از قبل inquiries.sales_expert_id است؛ این دو مکمل اون هستن.
-- هر دو Nullable و صرفاً پیش‌فرض تخصیص Activity/نمایش در لیست استعلام‌ها هستن —
-- procurement_owner_id هرگز supplier_rfqs.commercial_expert_id (مالک هر RFQ
-- به‌صورت مستقل) رو محدود یا override نمی‌کنه.
ALTER TABLE inquiries
    ADD COLUMN procurement_owner_id UUID REFERENCES users(id),
    ADD COLUMN finance_owner_id     UUID REFERENCES users(id);

-- تگ سبک برای شناسایی قابل‌اتکای «کدوم Activity باز، مرحلهٔ سیستمی چرخهٔ استعلامه»
-- (نه با Convention نام subject/activityType) — فقط برای ۹ Trigger خودکار پر می‌شه؛
-- برای فعالیت‌های دستی/عمومی (تماس، جلسه، Mention و...) همیشه NULL می‌مونه.
ALTER TABLE activities
    ADD COLUMN related_stage_code VARCHAR(30);

-- ============================================================================
-- ROLLBACK (دستی، این پروژه ابزار Down-Migration نداره):
--   ALTER TABLE activities DROP COLUMN related_stage_code;
--   ALTER TABLE inquiries DROP COLUMN procurement_owner_id;
--   ALTER TABLE inquiries DROP COLUMN finance_owner_id;
-- ============================================================================
