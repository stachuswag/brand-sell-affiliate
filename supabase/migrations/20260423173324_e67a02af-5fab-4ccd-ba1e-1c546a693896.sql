ALTER TABLE public.affiliate_links DROP COLUMN IF EXISTS offer_id;
DROP TABLE IF EXISTS public.offer_attachments CASCADE;
DROP TABLE IF EXISTS public.partner_offers CASCADE;
DROP TABLE IF EXISTS public.offers CASCADE;