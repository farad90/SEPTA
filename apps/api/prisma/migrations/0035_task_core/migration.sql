-- Migration 0035_task_core — گسترش activities به هستهٔ Work Management
-- (Business Action Hub، فاز توسعه‌یافته): Watcher، Timeline (کامنت+لاگ ترکیبی،
-- هم‌الگوی inquiry_discussions)، و effect ساختاریافته روی نتایج به‌جای فقط
-- boolean requires_follow_up. جدول activities عمداً دست‌نخورده می‌مونه — این
-- دو جدول جدید متعلق به همون دامنهٔ activities هستن، نه یک موجودیت جدا.
-- Rollback: DROP TABLE task_timeline_entries; DROP TABLE task_watchers;
--           ALTER TABLE activity_outcome_templates DROP COLUMN effect;

CREATE TABLE task_watchers (
    task_id           UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by_user_id  UUID NOT NULL REFERENCES users(id),
    added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

-- تاریخچهٔ کامل هر Task — کامنت آزاد کاربر + لاگ خودکار سیستم، دقیقاً هم‌الگوی inquiry_discussions
CREATE TABLE task_timeline_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    entry_type   VARCHAR(20) NOT NULL CHECK (entry_type IN ('comment', 'activity')),
    author_id    UUID NOT NULL REFERENCES users(id),
    entry_text   TEXT NOT NULL,
    action_kind  VARCHAR(30),
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_timeline_entries_task ON task_timeline_entries(task_id, created_at);

-- به‌جای فقط requires_follow_up (boolean)، سه اثر ممکن روی ثبت نتیجه — طبق طراحی
-- UX تأییدشده: پیش‌فرض «همین Task باز می‌مونه»، نه همیشه ساخت Task جدید
ALTER TABLE activity_outcome_templates
    ADD COLUMN effect VARCHAR(20) NOT NULL DEFAULT 'close'
        CHECK (effect IN ('close', 'create_follow_up', 'keep_waiting'));

-- بک‌فیل عمومی از boolean قدیمی — مقادیر دقیق‌تر بعداً با seed.ts (منبع حقیقت
-- کاتالوگ قالب‌ها) اصلاح می‌شن؛ ستون requires_follow_up قدیمی طبق قاعدهٔ افزودنی
-- پروژه حذف نمی‌شه، فقط دیگه در منطق جدید خونده نمی‌شه
UPDATE activity_outcome_templates SET effect = 'create_follow_up' WHERE requires_follow_up = true;
