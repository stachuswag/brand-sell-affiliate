
-- Delete profiles where the auth user no longer exists
DELETE FROM public.profiles
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Delete user_roles where the auth user no longer exists
DELETE FROM public.user_roles
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Delete chat_channel_members where the auth user no longer exists
DELETE FROM public.chat_channel_members
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Create a trigger function to cascade delete profile/roles when auth user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE user_id = OLD.id;
  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  DELETE FROM public.chat_channel_members WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Create trigger on auth.users for deletion
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();
