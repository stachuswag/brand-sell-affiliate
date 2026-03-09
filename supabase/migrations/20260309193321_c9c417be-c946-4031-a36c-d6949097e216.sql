
-- Fix infinite recursion in user_roles RLS policy
-- The old policy was querying user_roles FROM user_roles, causing recursion
-- Replace with the has_role() SECURITY DEFINER function which bypasses RLS

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
