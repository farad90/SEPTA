-- فاز ۵۳ — گزینه سوم پاسخ تأمین‌کننده به RFQ: «رد شد توسط تأمین‌کننده» + علت رد
-- (قبلاً فقط «سوال فنی» و «پیشنهاد قیمت» وجود داشت — بازخورد کاربر: تأمین‌کننده ممکنه
-- صراحتاً درخواست رو رد کنه، این حالت باید جدا از «بدون پاسخ» (سکوت) ثبت بشه)

ALTER TABLE supplier_rfqs DROP CONSTRAINT supplier_rfqs_status_check;
ALTER TABLE supplier_rfqs ADD CONSTRAINT supplier_rfqs_status_check
    CHECK (status IN ('awaiting_response', 'no_response', 'technical_question', 'offer_received', 'rejected_by_supplier'));

ALTER TABLE supplier_rfqs ADD COLUMN rejection_reason TEXT;

-- Rollback:
-- ALTER TABLE supplier_rfqs DROP COLUMN rejection_reason;
-- ALTER TABLE supplier_rfqs DROP CONSTRAINT supplier_rfqs_status_check;
-- ALTER TABLE supplier_rfqs ADD CONSTRAINT supplier_rfqs_status_check
--     CHECK (status IN ('awaiting_response', 'no_response', 'technical_question', 'offer_received'));
