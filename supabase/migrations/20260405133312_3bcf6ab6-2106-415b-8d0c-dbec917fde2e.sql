
-- Create partner_files table
CREATE TABLE public.partner_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_files ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage partner_files"
ON public.partner_files
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Employees can view and insert
CREATE POLICY "Employees can view partner_files"
ON public.partner_files
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can insert partner_files"
ON public.partner_files
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'employee'::app_role));

-- Agents can view files for their partner
CREATE POLICY "Agents can view own partner_files"
ON public.partner_files
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'agent'::app_role
    AND user_roles.partner_id = partner_files.partner_id
));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-files', 'partner-files', true);

-- Storage policies
CREATE POLICY "Anyone can view partner files"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-files');

CREATE POLICY "Authenticated users can upload partner files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'partner-files');
