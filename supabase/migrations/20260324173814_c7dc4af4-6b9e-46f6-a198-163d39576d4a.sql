
-- Add 'agent' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';

-- Add partner_id to user_roles to link agent users to partners
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

-- Add agent_user_id to partners so we can quickly find the agent user for a partner
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS agent_user_id UUID UNIQUE;
