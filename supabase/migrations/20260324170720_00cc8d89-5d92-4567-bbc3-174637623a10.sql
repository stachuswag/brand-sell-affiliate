-- Fix search_path for newly created functions
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.set_landing_page_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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