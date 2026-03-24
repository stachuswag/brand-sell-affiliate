
-- Add closed_at column to chat_channel_members for "archive/close" feature
ALTER TABLE public.chat_channel_members
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone DEFAULT NULL;
