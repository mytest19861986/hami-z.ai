-- ─────────────────────────────────────────────────────────────────────────────
-- اینوارینت‌های سطح دیتابیس حامی‌کارت (PRD v1.0 · AC-12/AC-11/AC-07)
-- این فایل باید پس از هر «prisma db push» مجدداً اجرا شود:
--   bunx prisma db execute --file prisma/invariants.sql --schema prisma/schema.prisma
-- ─────────────────────────────────────────────────────────────────────────────

-- SETTLE-005 · AC-12: حداکثر یک درخواست باز تسویه به ازای هر کاربر
-- (ایندکس یکتای جزئی — حتی نوشتن مستقیم در دیتابیس هم قید را نمی‌شکند)
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_one_open_per_user
  ON SettlementRequest (userId)
  WHERE status IN ('PENDING', 'APPROVED');

-- WALLET-006: دفترکل مالی Append-Only — هیچ ردیفی پس از ثبت قابل ویرایش/حذف نیست
CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_no_update
BEFORE UPDATE ON WalletTransaction
BEGIN
  SELECT RAISE(ABORT, 'WALLET_LEDGER_APPEND_ONLY: wallet ledger entries are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_no_delete
BEFORE DELETE ON WalletTransaction
BEGIN
  SELECT RAISE(ABORT, 'WALLET_LEDGER_APPEND_ONLY: wallet ledger entries are immutable');
END;
