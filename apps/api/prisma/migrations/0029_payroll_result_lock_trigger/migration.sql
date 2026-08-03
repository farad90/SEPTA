-- Migration 0029_payroll_result_lock_trigger — خط دفاعی دوم برای الزام معماری «پس از
-- Locked هیچ تغییری مجاز نیست» (علاوه بر گارد سطح اپلیکیشن در StoreResultStage/
-- PayrollWorkflowService). حتی UPDATE/DELETE مستقیم روی جدول (مثلاً از psql یا یک
-- اسکریپت آینده که از مسیر اپلیکیشن عبور نکرده) دیگر نمی‌تواند یک نتیجه‌ی قفل‌شده را
-- تغییر یا حذف کند.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_prevent_locked_payroll_result_mutation ON payroll_results;
--   DROP FUNCTION IF EXISTS prevent_locked_payroll_result_mutation();

CREATE OR REPLACE FUNCTION prevent_locked_payroll_result_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'locked' THEN
        RAISE EXCEPTION 'payroll_results: رکورد قفل‌شده (locked) قابل تغییر یا حذف نیست (id=%)', OLD.id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_payroll_result_mutation
    BEFORE UPDATE OR DELETE ON payroll_results
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_payroll_result_mutation();
