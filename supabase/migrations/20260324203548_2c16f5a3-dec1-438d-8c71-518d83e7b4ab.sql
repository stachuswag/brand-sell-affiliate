
-- Create a security definer function to check channel membership without triggering RLS
CREATE OR REPLACE FUNCTION public.user_is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  );
$$;

-- Drop old recursive policies on chat_channel_members
DROP POLICY IF EXISTS "Members can view channel members" ON public.chat_channel_members;

-- New non-recursive policy: users can see memberships of channels they belong to
CREATE POLICY "Members can view channel members"
  ON public.chat_channel_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_is_channel_member(auth.uid(), channel_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Drop and recreate the recursive policy on chat_channels
DROP POLICY IF EXISTS "Members can view their channels" ON public.chat_channels;

CREATE POLICY "Members can view their channels"
  ON public.chat_channels
  FOR SELECT
  TO authenticated
  USING (
    type = 'general'
    OR public.user_is_channel_member(auth.uid(), id)
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Drop and recreate chat_messages select policy
DROP POLICY IF EXISTS "Channel members can view messages" ON public.chat_messages;

CREATE POLICY "Channel members can view messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_channel_member(auth.uid(), channel_id)
    OR EXISTS (
      SELECT 1 FROM public.chat_channels cc
      WHERE cc.id = channel_id AND cc.type = 'general'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Drop and recreate chat_messages insert policy
DROP POLICY IF EXISTS "Channel members can send messages" ON public.chat_messages;

CREATE POLICY "Channel members can send messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.user_is_channel_member(auth.uid(), channel_id)
      OR EXISTS (
        SELECT 1 FROM public.chat_channels cc
        WHERE cc.id = channel_id AND cc.type = 'general'
      )
    )
  );
