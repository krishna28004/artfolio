-- ARTfolio PostgreSQL Payment Constraints Migration
-- Migration: 20260924020000_fix_payment_constraints.sql
-- Description: Makes razorpay_payment_id nullable for 'created' orders while enforcing NOT NULL on captured payments

-- 1. Allow razorpay_payment_id to be NULL when payment is initially created
ALTER TABLE public.payments ALTER COLUMN razorpay_payment_id DROP NOT NULL;

-- 2. Add constraint: captured payments MUST have a razorpay_payment_id
ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS check_captured_payment_id;

ALTER TABLE public.payments
    ADD CONSTRAINT check_captured_payment_id CHECK (
        (status IN ('created', 'attempted', 'failed')) OR (razorpay_payment_id IS NOT NULL)
    );

-- 3. Ensure lookup indexes exist
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
