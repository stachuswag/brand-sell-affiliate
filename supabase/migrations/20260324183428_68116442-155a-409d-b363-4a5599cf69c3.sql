-- Allow anonymous users to read partner names and agent_user_id status for the login page
CREATE POLICY "Anyone can view partner names for login"
ON public.partners
FOR SELECT
TO anon
USING (true);