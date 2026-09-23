-- ARTfolio PostgreSQL Production Extensions & Seed Migration
-- Migration: 20260924000000_production_schema_and_seed.sql
-- Description: Reconciles schema, adds payments, audit_logs, artwork_views tables, and seeds catalog

-- 1. Extend Artworks Table
ALTER TABLE public.artworks
    ADD COLUMN IF NOT EXISTS artist TEXT NOT NULL DEFAULT 'Krishna Kumar',
    ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2024,
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS position_3d JSONB,
    ADD COLUMN IF NOT EXISTS rotation_3d JSONB,
    ADD COLUMN IF NOT EXISTS wall_identifier TEXT,
    ADD COLUMN IF NOT EXISTS texture_url TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Extend Commissions Table
ALTER TABLE public.commissions
    DROP CONSTRAINT IF EXISTS commissions_status_check;

ALTER TABLE public.commissions
    ADD CONSTRAINT commissions_status_check CHECK (
        status IN ('pending', 'approved', 'payment_pending', 'paid', 'fulfilled', 'rejected', 'expired', 'cancelled')
    ),
    ADD COLUMN IF NOT EXISTS checkout_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS reference_artwork_id TEXT REFERENCES public.artworks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_checkout_token_hash ON public.commissions(checkout_token_hash);

-- 3. Payments Audit Trail Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE RESTRICT,
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT UNIQUE NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0), -- In integer paise
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('created', 'attempted', 'captured', 'failed', 'refunded')),
    method TEXT,
    error_code TEXT,
    error_description TEXT,
    event_id TEXT UNIQUE, -- Gateway event identifier for webhook idempotency
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_commission_id ON public.payments(commission_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);

-- 4. Administrative Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT NOT NULL, -- e.g. admin email or 'system' or 'webhook'
    action TEXT NOT NULL, -- 'approve', 'reject', 'cancel', 'price_set', 'payment_captured', 'refund', 'artwork_create', 'artwork_update', 'artwork_archive'
    target_type TEXT NOT NULL, -- 'commission', 'artwork', 'payment'
    target_id TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 5. Authentic Telemetry Table
CREATE TABLE IF NOT EXISTS public.artwork_views (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artwork_id TEXT NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
    ip_hash TEXT NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artwork_views_artwork_id ON public.artwork_views(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_views_viewed_at ON public.artwork_views(artwork_id, viewed_at);

-- 6. Row Level Security Configuration
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artwork_views ENABLE ROW LEVEL SECURITY;

-- Payments: Only accessible via server service-role (supabaseAdmin)
CREATE POLICY "Allow service role only on payments"
    ON public.payments
    FOR ALL
    USING (false);

-- Audit logs: Only accessible via server service-role (supabaseAdmin)
CREATE POLICY "Allow service role only on audit_logs"
    ON public.audit_logs
    FOR ALL
    USING (false);

-- Views: Public can insert view events, public can read aggregated count
CREATE POLICY "Allow public insert on artwork_views"
    ON public.artwork_views
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public select on artwork_views"
    ON public.artwork_views
    FOR SELECT
    USING (true);

-- 7. Seed Artworks Catalog Idempotently
INSERT INTO public.artworks (
    id, title, artist, year, description, medium, dimensions, price, category,
    image_url, is_available, is_featured, display_order, position_3d, rotation_3d, wall_identifier
) VALUES
(
    'luminous-veil',
    'Luminous Veil',
    'Krishna Kumar',
    2024,
    'A striking portrait of a child bathed in projected stripes of light. The interplay between shadow and luminance across the skin reveals an extraordinary depth of tone and texture, transforming the human form into a living landscape of light.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'portrait',
    '/images/artworks/luminous-veil.jpg',
    true,
    true,
    1,
    '[-24.92, 2.1, -28]'::jsonb,
    '[0, 1.5707963267948966, 0]'::jsonb,
    'west'
),
(
    'sovereign-gaze',
    'Sovereign Gaze',
    'Krishna Kumar',
    2024,
    'A hyper-realistic close-up of a tiger face, rendered with painstaking fur-by-fur detail. The piercing eyes and symmetrical stripe patterns convey an overwhelming presence - raw power frozen in graphite.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'wildlife',
    '/images/artworks/sovereign-gaze.jpg',
    true,
    true,
    2,
    '[-24.92, 2.1, -12]'::jsonb,
    '[0, 1.5707963267948966, 0]'::jsonb,
    'west'
),
(
    'monsoon-child',
    'Monsoon Child',
    'Krishna Kumar',
    2024,
    'A child pours water over their head from a steel cup, every single droplet captured in exquisite photorealistic detail. The bokeh background and glistening skin showcase mastery over water reflections in graphite.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'portrait',
    '/images/artworks/monsoon-child.jpg',
    true,
    true,
    3,
    '[-24.92, 2.1, 4]'::jsonb,
    '[0, 1.5707963267948966, 0]'::jsonb,
    'west'
),
(
    'tears-in-the-rain',
    'Tears in the Rain',
    'Krishna Kumar',
    2024,
    'An intimate close-up of a child face with eyes gently closed as rain cascades down. The water droplets clinging to skin, the serene expression amid the downpour - a meditation on innocence and vulnerability.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'portrait',
    '/images/artworks/tears-in-the-rain.jpg',
    true,
    true,
    4,
    '[-24.92, 2.1, 20]'::jsonb,
    '[0, 1.5707963267948966, 0]'::jsonb,
    'west'
),
(
    'the-dreamer',
    'The Dreamer',
    'Krishna Kumar',
    2024,
    'A warm, inviting portrait of a young man with tousled hair and a gentle smile. The soft tonal gradations and lifelike sparkle in the eyes demonstrate exceptional control over light and shadow in graphite.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'portrait',
    '/images/artworks/the-dreamer.jpg',
    true,
    false,
    5,
    '[24.92, 2.1, -28]'::jsonb,
    '[0, -1.5707963267948966, 0]'::jsonb,
    'east'
),
(
    'behind-the-lens',
    'Behind the Lens',
    'Krishna Kumar',
    2024,
    'A charismatic portrait of a man in round sunglasses and a tailored blazer. The pencil work captures the transparent quality of the lenses, the texture of facial hair, and the warmth of a genuine smile.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'portrait',
    '/images/artworks/behind-the-lens.jpg',
    true,
    false,
    6,
    '[24.92, 2.1, -12]'::jsonb,
    '[0, -1.5707963267948966, 0]'::jsonb,
    'east'
),
(
    'radiant-spirit',
    'Radiant Spirit',
    'Krishna Kumar',
    2024,
    'A joyful portrait capturing an infectious, beaming smile. The collar detail and soft skin tones showcase delicate pencil pressure control, while the radiant energy leaps off the paper.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'portrait',
    '/images/artworks/radiant-spirit.jpg',
    true,
    false,
    7,
    '[24.92, 2.1, 4]'::jsonb,
    '[0, -1.5707963267948966, 0]'::jsonb,
    'east'
),
(
    'chrome-elegy',
    'Chrome Elegy',
    'Krishna Kumar',
    2024,
    'A hyper-realistic study of a chrome water faucet, exploring metallic reflections and distortions. The polished surface becomes a mirror world rendered entirely in graphite - a testament to observational precision.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'still-life',
    '/images/artworks/chrome-elegy.jpg',
    true,
    false,
    8,
    '[24.92, 2.1, 20]'::jsonb,
    '[0, -1.5707963267948966, 0]'::jsonb,
    'east'
),
(
    'the-curious-mr-bean',
    'The Curious Mr. Bean',
    'Krishna Kumar',
    2024,
    'Rowan Atkinson captured in his iconic Mr. Bean persona, peeking curiously from behind a wall. The wide-eyed expression, the bow tie, and the perfectly timed comedic tension are all rendered with remarkable accuracy.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'character',
    '/images/artworks/the-curious-mr-bean.jpg',
    true,
    false,
    9,
    '[-10, 2.1, -39.92]'::jsonb,
    '[0, 0, 0]'::jsonb,
    'north'
),
(
    'sorcerer-supreme',
    'Sorcerer Supreme',
    'Krishna Kumar',
    2024,
    'A dramatic portrait inspired by Doctor Strange, featuring an ornate high collar and intense sidelong gaze. The intricate costume detailing and moody lighting showcase advanced pencil rendering technique.',
    'Pencil on Paper',
    'A3 Sheet',
    NULL,
    'character',
    '/images/artworks/sorcerer-supreme.jpg',
    true,
    false,
    10,
    '[10, 2.1, -39.92]'::jsonb,
    '[0, 0, 0]'::jsonb,
    'north'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    artist = EXCLUDED.artist,
    year = EXCLUDED.year,
    description = EXCLUDED.description,
    medium = EXCLUDED.medium,
    dimensions = EXCLUDED.dimensions,
    category = EXCLUDED.category,
    image_url = EXCLUDED.image_url,
    is_available = EXCLUDED.is_available,
    is_featured = EXCLUDED.is_featured,
    display_order = EXCLUDED.display_order,
    position_3d = EXCLUDED.position_3d,
    rotation_3d = EXCLUDED.rotation_3d,
    wall_identifier = EXCLUDED.wall_identifier,
    updated_at = timezone('utc'::text, now());
