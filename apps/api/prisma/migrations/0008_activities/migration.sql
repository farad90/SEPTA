-- ============================================================
-- فاز ۱۶ — مرکز فعالیت‌ها (Action Center)، بخش ۱: هستهٔ Activity
-- جایگزین ماژول Reminders (فاز ۱۴) — چون reminders خودمون اضافه کرده
-- بودیم (نه بخشی از erp-schema.sql پایه)، حذفش نقض schema پایه نیست.
-- ============================================================

DROP TABLE reminders;

CREATE TABLE activities (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type             VARCHAR(30) NOT NULL
                                  CHECK (activity_type IN ('call','email','meeting','follow_up','reminder','approval','internal_task')),
    subject                   VARCHAR(300) NOT NULL,
    description                TEXT,
    related_entity_type       VARCHAR(30),   -- فعلاً فقط 'inquiry'؛ NULL یعنی فعالیت شخصی بدون اتصال
    related_entity_id         UUID,
    priority                   VARCHAR(20) NOT NULL DEFAULT 'normal'
                                  CHECK (priority IN ('low','normal','high','urgent')),
    status                     VARCHAR(20) NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','scheduled','waiting','overdue','completed','cancelled')),
    scheduled_at               TIMESTAMPTZ,
    due_at                      TIMESTAMPTZ,
    completed_at                TIMESTAMPTZ,
    assigned_to_user_id         UUID NOT NULL REFERENCES users(id),
    created_by_user_id          UUID NOT NULL REFERENCES users(id),
    outcome_note                 TEXT,   -- موقت — فاز ۱۷ با outcome_id ساختاریافته تکمیلش می‌کنه
    follow_up_of_activity_id     UUID REFERENCES activities(id),
    call_recording_url           TEXT,   -- VoIP-ready، فعلاً بدون استفاده
    ai_summary                    TEXT,   -- AI-ready، فعلاً بدون استفاده
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_assigned ON activities (assigned_to_user_id, status);
CREATE INDEX idx_activities_related ON activities (related_entity_type, related_entity_id);
