# سپتا — ERP پولاد تجهیز آپادانا

Stack: Node.js (Express/NestJS) + PostgreSQL

# مراجع طراحی (نخون مگر لازم شد)
- @erp-schema.sql — اسکیمای کامل دیتابیس، منبع حقیقت
- @erp-database-design.md — تصمیمات و دلایل طراحی هر جدول
- @erp-16-marhale-fields.md — درفت اولیه فیلدهای ورودی ۱۶ مرحله فرآیند سفارش (فقط داده، نه ساختار دیتابیس)
- پوشه `mockups/` — مرجع بصری UI (توکن‌های رنگ، فونت Vazirmatn، الگوی view/edit/delete-with-confirm). هر فایل مستقله، بین‌شون import مشترک نیست.

# دستورات
npm run dev / npm test / npm run migrate  (بعد از تصمیم نهایی معماری پر کن)

# قواعد
- RTL و فارسی در همه UI
- هر Migration باید قابل Rollback باشه
- هرگز secrets رو کامیت نکن
