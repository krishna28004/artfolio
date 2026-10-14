-- Retain the legacy object reference column for older inquiry records.
-- Preserve existing references. Do not drop this column as an application rollback.
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS public_id TEXT;
