
-- Chat channels (general, direct, group)
CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'direct', 'group')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Channel members
CREATE TABLE public.chat_channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat channels: authenticated users can see channels they're members of, or general/group where they're a member
CREATE POLICY "Members can view their channels"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    type = 'general'
    OR EXISTS (
      SELECT 1 FROM public.chat_channel_members
      WHERE channel_id = chat_channels.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create channels"
  ON public.chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Channel creator can update channel"
  ON public.chat_channels FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Channel members: members can view membership of their channels
CREATE POLICY "Members can view channel members"
  ON public.chat_channel_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channel_members cm2
      WHERE cm2.channel_id = chat_channel_members.channel_id AND cm2.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Authenticated users can join channels"
  ON public.chat_channel_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can leave channels"
  ON public.chat_channel_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Messages: channel members can read/write
CREATE POLICY "Channel members can view messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channel_members
      WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = chat_messages.channel_id AND type = 'general'
    )
  );

CREATE POLICY "Channel members can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.chat_channel_members
        WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_channels
        WHERE id = chat_messages.channel_id AND type = 'general'
      )
    )
  );

CREATE POLICY "Senders can delete own messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Updated at trigger
CREATE TRIGGER update_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;

-- Seed a default general channel
INSERT INTO public.chat_channels (id, name, type)
VALUES ('00000000-0000-0000-0000-000000000001', 'Ogólny', 'general');

-- Storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Anyone can view chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

CREATE POLICY "Users can delete their own chat files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);
