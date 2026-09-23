-- ARTfolio PostgreSQL Database Schema Migration
-- Migration: 20260923000000_initial_schema.sql
-- Description: Establishes authoritative tables, constraints, indexes, and RLS policies

-- 1. Artworks Table
CREATE TABLE IF NOT EXISTS public.artworks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    medium TEXT DEFAULT 'Pencil on Paper',
    dimensions TEXT DEFAULT 'A3 Sheet',
    price BIGINT CHECK (price IS NULL OR price > 0), -- Stored in integer paise (INR)
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on created_at for fast chronologically sorted catalog reads
CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON public.artworks(created_at DESC);

-- 2. Commissions Table
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    image_url TEXT,
    size TEXT NOT NULL,
    budget TEXT NOT NULL,
    deadline TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'payment_pending', 'paid', 'fulfilled', 'expired', 'cancelled')
    ),
    price BIGINT CHECK (price IS NULL OR price > 0), -- Stored strictly in integer paise (INR)
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- High-performance lookup indexes for financial & inquiry workflows
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_idempotency_key ON public.commissions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_commissions_razorpay_order_id ON public.commissions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_email ON public.commissions(email);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Artworks: Anyone can view catalog pieces
CREATE POLICY "Allow public read on artworks"
    ON public.artworks
    FOR SELECT
    USING (true);

-- Commissions: Anyone can submit a commission inquiry
CREATE POLICY "Allow public insert on commissions"
    ON public.commissions
    FOR INSERT
    WITH CHECK (true);

-- Commissions: Anyone can read a commission record by direct ID (needed for public checkout)
CREATE POLICY "Allow public read on commissions"
    ON public.commissions
    FOR SELECT
    USING (true);

-- Notice: NO public UPDATE or DELETE policies are granted on commissions.
-- All state mutations (approval, payment_pending, paid, expired) MUST be performed
-- by the server using the service-role client (supabaseAdmin) which bypasses RLS.
