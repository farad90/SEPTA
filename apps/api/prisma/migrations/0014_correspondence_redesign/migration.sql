-- فاز ۲۴ — بازطراحی مکاتبات جهت‌محور (دامنه ۸)
-- افزودنی و کاملاً Rollback-پذیر — به SPEC-PHASE-24.md نگاه کن

ALTER TABLE letters
    ADD COLUMN responsible_user_id          UUID REFERENCES users(id),
    ADD COLUMN sender_reference_number      VARCHAR(100),
    ADD COLUMN internal_from_department_id  UUID REFERENCES departments(id),
    ADD COLUMN internal_to_department_id    UUID REFERENCES departments(id);

CREATE TABLE letter_signers (
    letter_id  UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (letter_id, user_id)
);

-- Rollback:
-- DROP TABLE letter_signers;
-- ALTER TABLE letters
--     DROP COLUMN responsible_user_id,
--     DROP COLUMN sender_reference_number,
--     DROP COLUMN internal_from_department_id,
--     DROP COLUMN internal_to_department_id;
