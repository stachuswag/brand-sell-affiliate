
CREATE TABLE public.partner_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (partner_id, offer_id)
);

ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partner_offers"
ON public.partner_offers FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage partner_offers"
ON public.partner_offers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
