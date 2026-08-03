-- Migration 0036_activity_type_mention — افزودن 'mention' به activity_type
-- (توسعهٔ Business Action Hub: منشن در گفتگوی پرونده به‌صورت یک Task واقعی
-- ثبت می‌شه، هم‌الگوی سایر انواع فعالیت). این مقدار قبلاً در سطح DTO اضافه
-- شده بود ولی از قلم افتاده بود که CHECK Constraint دیتابیس هم به‌روز بشه.
-- Rollback: برگردوندن لیست قبلی در ALTER زیر (بدون 'mention').

ALTER TABLE activities DROP CONSTRAINT activities_activity_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
    CHECK (activity_type IN ('call','email','meeting','follow_up','reminder','approval','internal_task','mention'));
