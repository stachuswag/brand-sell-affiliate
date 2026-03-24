-- Update notify_admins_on_contact to show partner name and landing page clearly
CREATE OR REPLACE FUNCTION public.notify_admins_on_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  link_info RECORD;
  notif_title TEXT;
  notif_message TEXT;
BEGIN
  -- Get affiliate link info including partner name and landing page title
  SELECT
    al.tracking_code,
    p.name AS partner_name,
    lp.title AS landing_page_title
  INTO link_info
  FROM public.affiliate_links al
  JOIN public.partners p ON al.partner_id = p.id
  LEFT JOIN public.landing_pages lp ON al.landing_page_id = lp.id
  WHERE al.id = NEW.affiliate_link_id;

  -- Build clear title and message
  IF link_info IS NOT NULL THEN
    notif_title := 'Nowy klient via ' || link_info.partner_name;
    notif_message :=
      '👤 ' || NEW.full_name ||
      CASE WHEN NEW.phone IS NOT NULL THEN ' | 📞 ' || NEW.phone ELSE '' END ||
      CASE WHEN NEW.email IS NOT NULL THEN ' | ✉ ' || NEW.email ELSE '' END ||
      ' | 🔗 via ' || link_info.partner_name ||
      CASE WHEN link_info.landing_page_title IS NOT NULL
        THEN ' (' || link_info.landing_page_title || ')'
        ELSE ' (kod: ' || link_info.tracking_code || ')'
      END;
  ELSE
    notif_title := 'Nowy klient — formularz bezpośredni';
    notif_message :=
      '👤 ' || NEW.full_name ||
      CASE WHEN NEW.phone IS NOT NULL THEN ' | 📞 ' || NEW.phone ELSE '' END ||
      CASE WHEN NEW.email IS NOT NULL THEN ' | ✉ ' || NEW.email ELSE '' END;
  END IF;

  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, contact_id, affiliate_link_id)
    VALUES (
      admin_record.user_id,
      notif_title,
      notif_message,
      NEW.id,
      NEW.affiliate_link_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;