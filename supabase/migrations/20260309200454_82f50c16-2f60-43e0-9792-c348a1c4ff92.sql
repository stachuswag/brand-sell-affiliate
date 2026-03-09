
-- Allow anyone (including anonymous users) to read active affiliate links
-- This is needed for the public tracking redirect page /c/:code to work
CREATE POLICY "Anyone can view active affiliate links"
ON public.affiliate_links
FOR SELECT
TO anon, authenticated
USING (is_active = true);
