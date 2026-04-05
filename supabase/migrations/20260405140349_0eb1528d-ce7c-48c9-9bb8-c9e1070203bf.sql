ALTER TABLE public.partner_files ADD COLUMN batch_token UUID DEFAULT gen_random_uuid();

-- Allow anyone to view files by batch token (public download page)
CREATE POLICY "Anyone can view files by batch_token"
ON public.partner_files
FOR SELECT
TO anon
USING (batch_token IS NOT NULL);