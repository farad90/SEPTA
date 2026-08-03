-- فاز ۲۷ — اسناد چندفایلی محموله + قفل مرحله + درخواست اصلاح با تأیید

-- جدول عمومی اسناد محموله — جایگزین ۱۷ ستون تک‌فایلهٔ پراکنده در shipments/export_documents/import_documents
-- هر جایگاه (doc_key) می‌تونه چند فایل هم‌زمان داشته باشه؛ آپلود جدید اضافه می‌شه نه جایگزین
CREATE TABLE shipment_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    doc_key      VARCHAR(50) NOT NULL,
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(300),
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipment_documents_shipment ON shipment_documents(shipment_id, doc_key);

-- درخواست اصلاح مرحلهٔ قفل‌شده — تأیید/رد توسط دارندهٔ shipping.approve_edit از داخل اعلان
CREATE TABLE shipment_edit_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id   UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    stage         VARCHAR(30) NOT NULL,
    reason        TEXT NOT NULL,
    requested_by  UUID NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by    UUID REFERENCES users(id),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- مرحله‌ای که با تأیید درخواست اصلاح موقتاً باز شده (حداکثر یکی در هر محموله؛ NULL = همه طبق قانون عادی قفل)
ALTER TABLE shipments ADD COLUMN unlocked_stage VARCHAR(30);

-- ------------------------------------------------------------
-- انتقال دادهٔ فایل‌های تک‌فایلهٔ موجود به جدول جدید (ستون‌های قدیمی Deprecated ولی دست‌نخورده می‌مونن)
-- ------------------------------------------------------------

-- ۴ جایگاه سطح خود shipments
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT id, 'export_declaration', export_declaration_file_url FROM shipments WHERE export_declaration_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT id, 'customs_declaration', customs_declaration_file_url FROM shipments WHERE customs_declaration_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT id, 'weighbridge_slip', weighbridge_slip_file_url FROM shipments WHERE weighbridge_slip_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT id, 'customs_exit_waybill', customs_exit_waybill_file_url FROM shipments WHERE customs_exit_waybill_file_url IS NOT NULL;

-- ۴ جایگاه export_documents
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'export_invoice', invoice_file_url FROM export_documents WHERE invoice_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'export_packing_list', packing_list_file_url FROM export_documents WHERE packing_list_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'non_dual_use', non_dual_use_certificate_url FROM export_documents WHERE non_dual_use_certificate_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'power_of_attorney', power_of_attorney_url FROM export_documents WHERE power_of_attorney_url IS NOT NULL;

-- ۹ جایگاه import_documents
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'import_invoice', import_invoice_file_url FROM import_documents WHERE import_invoice_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'import_packing_list', import_packing_list_file_url FROM import_documents WHERE import_packing_list_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'bill_of_lading', bill_of_lading_file_url FROM import_documents WHERE bill_of_lading_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'warehouse_slip', warehouse_slip_file_url FROM import_documents WHERE warehouse_slip_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'clearance_permit', clearance_permit_file_url FROM import_documents WHERE clearance_permit_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'freight_invoice_rial', freight_invoice_rial_file_url FROM import_documents WHERE freight_invoice_rial_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'freight_invoice_forex', freight_invoice_forex_file_url FROM import_documents WHERE freight_invoice_forex_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'inspection_certificate', inspection_certificate_file_url FROM import_documents WHERE inspection_certificate_file_url IS NOT NULL;
INSERT INTO shipment_documents (shipment_id, doc_key, file_url)
SELECT shipment_id, 'certificate_of_origin', certificate_of_origin_file_url FROM import_documents WHERE certificate_of_origin_file_url IS NOT NULL;
