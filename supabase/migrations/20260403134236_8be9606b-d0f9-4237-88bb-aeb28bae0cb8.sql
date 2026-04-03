
-- Add column to mark offers submitted by a partner
ALTER TABLE public.offers ADD COLUMN submitted_by_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL DEFAULT NULL;

-- Allow agents to insert offers linked to their partner
CREATE POLICY "Agents can insert own partner offers"
ON public.offers
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by_partner_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'agent'
      AND partner_id = offers.submitted_by_partner_id
  )
);

-- Allow agents to update their own partner's submitted offers
CREATE POLICY "Agents can update own partner offers"
ON public.offers
FOR UPDATE
TO authenticated
USING (
  submitted_by_partner_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'agent'
      AND partner_id = offers.submitted_by_partner_id
  )
);

-- Also allow agents to insert into partner_offers for their own partner
CREATE POLICY "Agents can insert own partner_offers"
ON public.partner_offers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'agent'
      AND partner_id = partner_offers.partner_id
  )
);

-- Allow agents to insert affiliate_links for their partner
CREATE POLICY "Agents can insert own affiliate links"
ON public.affiliate_links
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'agent'
      AND partner_id = affiliate_links.partner_id
  )
);
