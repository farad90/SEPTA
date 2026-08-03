-- ============================================================
-- فاز ۳۵-ج — گردش تأیید مدیر برای کاهش قیمت پیشنهاد مالی
-- الگوی دقیقاً هم‌ساختار shipment_edit_requests (فاز ۲۷)
-- ============================================================

CREATE TABLE financial_proposal_price_change_requests (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_proposal_item_id  UUID NOT NULL REFERENCES financial_proposal_items(id) ON DELETE CASCADE,
    requested_price             NUMERIC(18,4) NOT NULL,
    requested_by                UUID NOT NULL REFERENCES users(id),
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by                  UUID REFERENCES users(id),
    decided_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_price_change_requests_item ON financial_proposal_price_change_requests(financial_proposal_item_id, status);
