-- ============================================================
-- فاز ۱۷ — مرکز فعالیت‌ها، بخش ۲: نتایج ساختاریافته + Auto Follow-up Engine
-- ============================================================

CREATE TABLE activity_outcome_templates (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type             VARCHAR(30) NOT NULL,
    label                     VARCHAR(200) NOT NULL,
    is_default                BOOLEAN NOT NULL DEFAULT false,
    requires_follow_up        BOOLEAN NOT NULL DEFAULT false,
    follow_up_activity_type   VARCHAR(30),
    follow_up_offset_minutes  INTEGER,
    created_by_user_id        UUID REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_type, label)
);

ALTER TABLE activities
    ADD COLUMN outcome_id UUID REFERENCES activity_outcome_templates(id);
