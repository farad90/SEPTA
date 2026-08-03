-- Migration 0031_inquiry_documents — پیوست‌های کلی سطح استعلام (Inquiry-level Attachments)
-- جدا از inquiry_item_documents (پیوست هر ردیف کالا) — برای فایل‌هایی که به کل پرونده
-- مربوطن، نه یک ردیف خاص. هم‌الگوی دقیق inquiry_item_documents.

CREATE TABLE inquiry_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(300),
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiry_documents_inquiry ON inquiry_documents(inquiry_id);
