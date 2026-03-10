ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS commission_amount NUMERIC;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percent';