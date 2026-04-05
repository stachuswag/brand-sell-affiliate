
-- Projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cities text[] NOT NULL DEFAULT '{}',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  materials_folder_url text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projects"
  ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage projects"
  ON public.projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link partners to projects (many-to-many)
CREATE TABLE public.partner_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(partner_id, project_id)
);

ALTER TABLE public.partner_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partner_projects"
  ON public.partner_projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage partner_projects"
  ON public.partner_projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can insert own partner_projects"
  ON public.partner_projects FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'agent'
      AND user_roles.partner_id = partner_projects.partner_id
  ));

-- Add Clay enrichment fields to partners
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS instagram_followers integer,
  ADD COLUMN IF NOT EXISTS clay_icebreaker text,
  ADD COLUMN IF NOT EXISTS clay_summary text,
  ADD COLUMN IF NOT EXISTS clay_enriched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS agent_status text DEFAULT 'new';

-- Link affiliate_links to projects
ALTER TABLE public.affiliate_links
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
