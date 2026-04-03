
-- Add parent_partner_id to partners for sub-partner hierarchy
ALTER TABLE public.partners ADD COLUMN parent_partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE;

-- Allow agents to delete contacts linked to their affiliate links
CREATE POLICY "Agents can delete own contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.affiliate_links al
    JOIN public.user_roles ur ON ur.partner_id = al.partner_id
    WHERE al.id = contacts.affiliate_link_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'agent'
  )
);

-- Allow agents to insert sub-partners (with parent_partner_id = their partner)
CREATE POLICY "Agents can insert sub-partners"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (
  parent_partner_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'agent'
      AND user_roles.partner_id = partners.parent_partner_id
  )
);

-- Allow agents to view their sub-partners
CREATE POLICY "Agents can view own sub-partners"
ON public.partners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'agent'
      AND user_roles.partner_id = partners.parent_partner_id
  )
);
