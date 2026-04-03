
-- Table for offer attachments (files and links)
CREATE TABLE public.offer_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL DEFAULT 'file' CHECK (attachment_type IN ('file', 'link')),
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  link_url TEXT,
  link_title TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view offer_attachments"
  ON public.offer_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage offer_attachments"
  ON public.offer_attachments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete offer_attachments"
  ON public.offer_attachments FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_offer_attachments_offer_id ON public.offer_attachments(offer_id);

-- Storage bucket for offer files
INSERT INTO storage.buckets (id, name, public) VALUES ('offer-files', 'offer-files', true);

CREATE POLICY "Anyone can view offer files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'offer-files');

CREATE POLICY "Authenticated users can upload offer files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'offer-files');

CREATE POLICY "Admins can delete offer files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'offer-files' AND has_role(auth.uid(), 'admin'::app_role));
