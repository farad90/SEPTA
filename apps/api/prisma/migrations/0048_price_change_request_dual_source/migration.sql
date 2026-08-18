-- Migration 0048_price_change_request_dual_source — رفع یک رگرسیون واقعی که migration 0047
-- ایجاد کرد: تغییر نام financial_proposal_item_id → pricing_option_item_id (با تغییر ارجاع از
-- financial_proposal_items به inquiry_pricing_option_items) گردش تأیید کاهش قیمت مسیر «تخت»/
-- تک‌ترمی قدیمی (فاز ۳۵-ج، ProposalService.saveFinancial) رو می‌شکست، چون اون مسیر هنوز از
-- FinancialProposalItem.id استفاده می‌کنه، نه InquiryPricingOptionItem.id.
--
-- این migration دو منشأ ممکن رو هم‌زمان پشتیبانی می‌کنه (هر دو Nullable؛ دقیقاً یکی‌شون در سطح
-- اپلیکیشن پر می‌شه، هم‌الگوی فرستنده/گیرنده نامه در جدول letters):
--   ۱) financial_proposal_item_id — مسیر تخت قدیمی
--   ۲) pricing_option_item_id — مسیر جدید «چند گزینه ترم تحویل» (فاز ۶۰)
-- روی این دیتابیس مشخص (پیش از استفاده واقعی) هیچ ردیفی در این جدول وجود نداره، پس نیازی به
-- بک‌فیل/تفکیک داده‌ی موجود نیست.

ALTER TABLE financial_proposal_price_change_requests
    ADD COLUMN financial_proposal_item_id UUID REFERENCES financial_proposal_items(id) ON DELETE CASCADE;

ALTER TABLE financial_proposal_price_change_requests
    ALTER COLUMN pricing_option_item_id DROP NOT NULL;

-- ============================================================================
-- ROLLBACK (دستی، این پروژه ابزار Down-Migration نداره):
--   ALTER TABLE financial_proposal_price_change_requests ALTER COLUMN pricing_option_item_id SET NOT NULL;
--   ALTER TABLE financial_proposal_price_change_requests DROP COLUMN financial_proposal_item_id;
-- ============================================================================
