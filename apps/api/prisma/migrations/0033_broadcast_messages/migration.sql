-- Migration 0033_broadcast_messages — پیام اعلامی مدیر در بدو ورود (فاز ۴۱-ج)
-- به‌جای فن‌اوت رکورد Notification در لحظه ایجاد پیام (پرهزینه برای هدف گروه/همه)،
-- یک جدول پیام + یک جدول «چه‌کسی دیده» می‌سازیم؛ کوئری «پیام‌های در انتظار من» در لحظه بررسی می‌شه.
-- Rollback: DROP TABLE broadcast_message_dismissals; DROP TABLE broadcast_messages;

CREATE TABLE broadcast_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url       TEXT,
    message         TEXT NOT NULL,
    target_type     VARCHAR(10) NOT NULL CHECK (target_type IN ('user', 'group', 'all')),
    target_user_id  UUID REFERENCES users(id),
    target_group_id UUID REFERENCES permission_groups(id),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcast_messages_active ON broadcast_messages(active);

-- ثبت این‌که کدوم کاربر کدوم پیام رو بسته — یک‌بار نمایش، دیگه هرگز تکرار نمی‌شه
CREATE TABLE broadcast_message_dismissals (
    broadcast_message_id UUID NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (broadcast_message_id, user_id)
);
