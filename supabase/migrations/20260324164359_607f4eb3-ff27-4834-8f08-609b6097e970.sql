
-- Create landing_pages table
CREATE TABLE public.landing_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  ai_prompt text,
  generated_content jsonb,
  hero_image_url text,
  images jsonb DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add landing_page_id to affiliate_links
ALTER TABLE public.affiliate_links
  ADD COLUMN landing_page_id uuid REFERENCES public.landing_pages(id) ON DELETE SET NULL;

-- Enable RLS on landing_pages
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage landing pages"
  ON public.landing_pages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view published landing pages
CREATE POLICY "Authenticated users can view landing pages"
  ON public.landing_pages FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anyone can view published landing pages (for public /lp/:id route)
CREATE POLICY "Anyone can view published landing pages"
  ON public.landing_pages FOR SELECT
  TO anon
  USING (is_published = true);

-- Trigger for updated_at
CREATE TRIGGER update_landing_pages_updated_at
  BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for landing page images
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-page-images', 'landing-page-images', true)
ON CONFLICT DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Anyone can view landing page images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'landing-page-images');

CREATE POLICY "Authenticated users can upload landing page images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'landing-page-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete landing page images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'landing-page-images' AND auth.uid() IS NOT NULL);
