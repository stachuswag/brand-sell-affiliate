-- Add slug column to landing_pages
ALTER TABLE public.landing_pages ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS landing_pages_slug_key ON public.landing_pages(slug);

-- Create a function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(input_text);
  result := replace(result, 'ą', 'a');
  result := replace(result, 'ć', 'c');
  result := replace(result, 'ę', 'e');
  result := replace(result, 'ł', 'l');
  result := replace(result, 'ń', 'n');
  result := replace(result, 'ó', 'o');
  result := replace(result, 'ś', 's');
  result := replace(result, 'ź', 'z');
  result := replace(result, 'ż', 'z');
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

-- Auto-populate slug for existing rows
UPDATE public.landing_pages
SET slug = public.generate_slug(title) || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL;

-- Trigger to auto-set slug on insert
CREATE OR REPLACE FUNCTION public.set_landing_page_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(NEW.title);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.landing_pages WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_landing_page_slug ON public.landing_pages;
CREATE TRIGGER trg_set_landing_page_slug
BEFORE INSERT OR UPDATE ON public.landing_pages
FOR EACH ROW EXECUTE FUNCTION public.set_landing_page_slug();