-- فاز ۲۵ — پیوست فایل در سطح کالا (نقشه/کاتالوگ/دیتاشیت)
-- چون کلید اصلی item_catalog یک کلید طبیعی (item_code) است نه UUID، ستون FK این جدول
-- هم VARCHAR(100) است، نه UUID — بر خلاف الگوی inquiry_item_documents
CREATE TABLE item_catalog_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code    VARCHAR(100) NOT NULL REFERENCES item_catalog(item_code) ON DELETE CASCADE,
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(300),
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
