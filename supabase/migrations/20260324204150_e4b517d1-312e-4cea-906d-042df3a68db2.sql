
-- Allow users to update their own membership (for closed_at column)
DROP POLICY IF EXISTS "Users can update their membership" ON public.chat_channel_members;
CREATE POLICY "Users can update their membership"
  ON public.chat_channel_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
