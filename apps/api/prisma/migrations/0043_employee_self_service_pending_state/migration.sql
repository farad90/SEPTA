-- پرسنل با حساب کاربری موجود: مدیر منابع انسانی فقط کاربر رو به یک پرونده پرسنلی وصل
-- می‌کنه (بدون شماره پرسنلی)؛ خود شخص اطلاعات فردی رو در پروفایل تکمیل می‌کنه؛ مدیر منابع
-- انسانی در پایان با تخصیص شماره پرسنلی، پرونده رو به‌عنوان «کارمند رسمی شرکت» ثبت می‌کنه.
-- تا قبل از اون، employee_number/our_entity_id/hire_date خالی می‌مونن — یعنی این سه ستون
-- باید Nullable بشن (قبلاً NOT NULL بودن، طبق طراحی اولیه که فرض می‌کرد همه‌چیز یک‌جا ثبت می‌شه)

ALTER TABLE employees ALTER COLUMN employee_number DROP NOT NULL;
ALTER TABLE employees ALTER COLUMN our_entity_id DROP NOT NULL;
ALTER TABLE employees ALTER COLUMN hire_date DROP NOT NULL;
