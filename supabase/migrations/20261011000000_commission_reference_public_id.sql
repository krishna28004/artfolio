-- Track the server-created Cloudinary object associated with an inquiry.
-- Reverse with: ALTER TABLE public.commissions DROP COLUMN public_id;
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS public_id TEXT;
