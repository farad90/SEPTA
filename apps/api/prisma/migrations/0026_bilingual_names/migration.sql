-- فاز ۳۹ — نام لاتین کاربران (برای اسناد PDF/Word انگلیسی) + آدرس انگلیسی شرکت‌های ما
ALTER TABLE users ADD COLUMN full_name_en VARCHAR(200);
ALTER TABLE our_entities ADD COLUMN address_en TEXT;
