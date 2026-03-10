
-- Create offers table
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  price NUMERIC,
  area_m2 NUMERIC,
  offer_type TEXT DEFAULT 'sale',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage offers"
ON public.offers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view offers"
ON public.offers FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.affiliate_links ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;
