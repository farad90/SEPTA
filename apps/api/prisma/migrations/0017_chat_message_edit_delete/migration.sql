-- فاز ۳۰ — امکان ویرایش/حذف پیام توسط خودِ فرستنده
-- حذف به‌صورت Soft Delete (مثل تلگرام): پیام از دیتابیس پاک نمی‌شه، فقط deleted_at پر می‌شه
-- و فرانت به‌جای متن واقعی «این پیام حذف شد» نشون می‌ده — جلوی خالی‌شدن گفت‌وگو رو می‌گیره
ALTER TABLE chat_messages
    ADD COLUMN edited_at  TIMESTAMPTZ,
    ADD COLUMN deleted_at TIMESTAMPTZ;
