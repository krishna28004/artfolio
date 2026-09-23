-- ARTfolio PostgreSQL Security Migration: Revoke Insecure Public RLS Policies
-- Migration: 20260924010000_secure_commission_rls.sql
-- Description: Drops public read and insert policies on commissions to prevent unauthenticated data leaks

-- 1. Drop insecure public policies
DROP POLICY IF EXISTS "Allow public read on commissions" ON public.commissions;
DROP POLICY IF EXISTS "Allow public insert on commissions" ON public.commissions;

-- 2. Ensure RLS remains strictly active on commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- 3. Explicitly deny all public (anon and authenticated) access to commissions.
-- All operations (inquiries, approval, checkout validation, payments, status changes)
-- are executed server-side via the service_role client (supabaseAdmin) which bypasses RLS.
CREATE POLICY "Deny public direct access to commissions"
    ON public.commissions
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
