ALTER TABLE public.partners ADD COLUMN login_email text;

-- Make login_email unique (only for non-null values)
CREATE UNIQUE INDEX partners_login_email_unique ON public.partners (login_email) WHERE login_email IS NOT NULL;