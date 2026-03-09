
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. USER ROLES
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Security definer function to check roles safely
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ==========================================
-- 2. PROFILES
-- ==========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 3. PARTNERS
-- ==========================================
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partners" ON public.partners
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 4. AFFILIATE LINKS
-- ==========================================
CREATE TYPE public.link_type AS ENUM ('partner', 'property');

CREATE TABLE public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  link_type link_type NOT NULL DEFAULT 'partner',
  property_name TEXT,
  property_address TEXT,
  destination_url TEXT,
  tracking_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view affiliate links" ON public.affiliate_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage affiliate links" ON public.affiliate_links
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 5. LINK CLICKS (tracking)
-- ==========================================
CREATE TABLE public.link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID NOT NULL REFERENCES public.affiliate_links(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clicks" ON public.link_clicks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can insert clicks" ON public.link_clicks
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 6. CONTACTS / LEADS
-- ==========================================
CREATE TYPE public.contact_status AS ENUM ('new', 'in_progress', 'deal_closed', 'no_deal');

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  status contact_status NOT NULL DEFAULT 'new',
  notes TEXT,
  source_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts" ON public.contacts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts" ON public.contacts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can insert contacts" ON public.contacts
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 7. TRANSACTIONS
-- ==========================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  affiliate_link_id UUID REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  property_name TEXT,
  deal_value NUMERIC(12, 2),
  commission_amount NUMERIC(12, 2),
  commission_paid BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transactions" ON public.transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage transactions" ON public.transactions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 8. NOTIFICATIONS
-- ==========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  affiliate_link_id UUID REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 9. UPDATED_AT TRIGGER FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_links_updated_at BEFORE UPDATE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 10. AUTO-CREATE PROFILE ON SIGNUP
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 11. FUNCTION: notify_all_admins_on_new_contact
-- ==========================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_contact()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
  link_info RECORD;
BEGIN
  SELECT al.tracking_code, p.name as partner_name
  INTO link_info
  FROM public.affiliate_links al
  JOIN public.partners p ON al.partner_id = p.id
  WHERE al.id = NEW.affiliate_link_id;

  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, contact_id, affiliate_link_id)
    VALUES (
      admin_record.user_id,
      'Nowy kontakt przez link afiliacyjny',
      CASE
        WHEN link_info IS NOT NULL THEN
          'Kontakt: ' || NEW.full_name || ' | Partner: ' || COALESCE(link_info.partner_name, '-') || ' | Kod: ' || COALESCE(link_info.tracking_code, '-')
        ELSE
          'Nowy kontakt: ' || NEW.full_name
      END,
      NEW.id,
      NEW.affiliate_link_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_new_contact_notify
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_contact();

-- ==========================================
-- 12. INDEXES
-- ==========================================
CREATE INDEX idx_affiliate_links_tracking_code ON public.affiliate_links(tracking_code);
CREATE INDEX idx_affiliate_links_partner_id ON public.affiliate_links(partner_id);
CREATE INDEX idx_contacts_affiliate_link_id ON public.contacts(affiliate_link_id);
CREATE INDEX idx_contacts_status ON public.contacts(status);
CREATE INDEX idx_link_clicks_affiliate_link_id ON public.link_clicks(affiliate_link_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_transactions_partner_id ON public.transactions(partner_id);
