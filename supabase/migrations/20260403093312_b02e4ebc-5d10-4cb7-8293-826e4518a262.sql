
CREATE POLICY "Admins can delete partner_offers"
ON public.partner_offers FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
