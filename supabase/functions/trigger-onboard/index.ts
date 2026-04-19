import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://hook.eu1.make.com/jfn3pvf8u2m3d8gkc8nkhxwrlqa4amyg";

type EmailType = "onboard" | "offer" | "general" | "follow_up" | "proposal" | "question";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Brak autoryzacji" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Nieautoryzowany" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Tylko admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      partner_id,
      email_type = "onboard" as EmailType,
      project_id,
      offer_id,
      custom_message,
      login_email,
      login_password,
    } = body;

    if (!partner_id) {
      return new Response(JSON.stringify({ error: "partner_id jest wymagane" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch partner
    const { data: partner, error: partnerError } = await adminClient
      .from("partners").select("*").eq("id", partner_id).single();
    if (partnerError || !partner) {
      return new Response(JSON.stringify({ error: "Partner nie znaleziony" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const recipientEmail = partner.email || partner.login_email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "Partner nie ma emaila ani loginu — uzupełnij email partnera w bazie" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const partnerName = partner.contact_person || partner.name;
    const firstName = partnerName.split(" ")[0];

    const appUrl = "https://brand-sell-affiliate.lovable.app";

    // Fetch affiliate links for this partner
    const { data: links } = await adminClient
      .from("affiliate_links")
      .select("tracking_code, destination_url, landing_page_id, project_id, offer_id")
      .eq("partner_id", partner_id)
      .eq("is_active", true);

    const linksHtml = (links || []).map((l: { tracking_code: string }) => {
      const url = `${appUrl}/c/${l.tracking_code}`;
      return `<li>🔗 <a href="${url}">${url}</a></li>`;
    }).join("\n");

    // Helper: fetch partner's projects
    const fetchPartnerProjects = async () => {
      const ids = new Set<string>();
      if (project_id) ids.add(project_id);
      const { data: pp } = await adminClient
        .from("partner_projects").select("project_id").eq("partner_id", partner_id);
      (pp || []).forEach((r: { project_id: string }) => ids.add(r.project_id));
      if (ids.size === 0) return [];
      const { data: prjs } = await adminClient
        .from("projects").select("id, name, cities, materials_folder_url").in("id", [...ids]);
      return prjs || [];
    };

    // Helper: fetch offer
    const fetchOffer = async (oid: string) => {
      const { data } = await adminClient.from("offers").select("*").eq("id", oid).single();
      return data;
    };

    // Helper: fetch partner's offers
    const fetchPartnerOffers = async () => {
      const { data: po } = await adminClient
        .from("partner_offers").select("offer_id").eq("partner_id", partner_id);
      if (!po || po.length === 0) return [];
      const { data: offers } = await adminClient
        .from("offers").select("*").in("id", po.map((r: { offer_id: string }) => r.offer_id));
      return offers || [];
    };

    let emailBody = "";

    const signature = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:2px solid #e5e7eb;padding-top:24px;">
        <tr>
          <td style="font-family:Arial,sans-serif;font-size:14px;color:#6b7280;">
            Pozdrawiamy serdecznie 🤝<br>
            <strong style="color:#111827;font-size:15px;">Zespół Brand and Sell</strong><br>
            <span style="font-size:12px;color:#9ca3af;">Twój partner w sprzedaży nieruchomości</span>
          </td>
        </tr>
      </table>
    </td></tr></table>`;

    const wrapper = (content: string) => `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header bar -->
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Brand and Sell</h1>
    <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">Twoja sieć partnerska nieruchomości</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px 32px 24px;font-size:15px;line-height:1.7;color:#374151;">
${content}
${signature}
</td></tr></table>
</td></tr></table>
</body></html>`;

    const sectionBox = (icon: string, title: string, items: string) =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0 0 8px;font-weight:600;font-size:14px;color:#1f2937;">${icon} ${title}</p>
          <ul style="margin:0;padding-left:20px;color:#4b5563;font-size:14px;line-height:1.8;">${items}</ul>
        </td></tr>
      </table>`;

    const linkBox = (links: string) =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0 0 8px;font-weight:600;font-size:14px;color:#1e40af;">🔗 Twoje linki afiliacyjne</p>
          <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.8;">${links}</ul>
          <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">📊 Każde kliknięcie jest automatycznie przypisane do Ciebie.</p>
        </td></tr>
      </table>`;

    const loginUrl = "https://brand-sell-affiliate.lovable.app/login";

    const ctaButton = (text: string, href = "mailto:") =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr><td align="center">
          <a href="${href}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#2563eb,#1e40af);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${text}</a>
        </td></tr>
      </table>`;

    const credentialsBox = (email: string, password: string) =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fefce8;border-radius:8px;border:1px solid #fde68a;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 10px;font-weight:600;font-size:14px;color:#92400e;">🔐 Twoje dane logowania</p>
          <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#78350f;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">📧 Login:</td><td style="padding:4px 0;">${email}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">🔑 Hasło:</td><td style="padding:4px 0;font-family:monospace;background:#fef3c7;padding:2px 8px;border-radius:4px;">${password}</td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#b45309;">⚠️ Nie udostępniaj nikomu swoich danych logowania!</p>
        </td></tr>
      </table>`;

    // ── ONBOARD ──
    if (email_type === "onboard") {
      await adminClient.from("partners").update({ agent_status: "approved" }).eq("id", partner_id);

      if (project_id) {
        await adminClient.from("partner_projects")
          .upsert({ partner_id, project_id }, { onConflict: "partner_id,project_id" });
      }

      const allProjects = await fetchPartnerProjects();
      const partnerOffers = await fetchPartnerOffers();

      const projectsHtml = allProjects.length > 0
        ? sectionBox("🏗️", "Twoje inwestycje", allProjects.map((p) => {
            const cities = p.cities?.length ? p.cities.join(", ") : "—";
            const mat = p.materials_folder_url ? ` — <a href="${p.materials_folder_url}" style="color:#2563eb;">📁 Materiały</a>` : "";
            return `<li><strong>${p.name}</strong> <span style="color:#6b7280;">(${cities})</span>${mat}</li>`;
          }).join(""))
        : "";

      const offersHtml = partnerOffers.length > 0
        ? sectionBox("📋", "Przypisane oferty", partnerOffers.map((o: { name: string; city?: string | null }) =>
            `<li>${o.name}${o.city ? ` <span style="color:#6b7280;">(${o.city})</span>` : ""}</li>`
          ).join(""))
        : "";

      emailBody = wrapper(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 8px;">🎉 Miło nam poinformować, że <strong>Twoje konto</strong> w Brand and Sell zostało <span style="color:#059669;font-weight:600;">aktywowane</span>!</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Od teraz jesteś częścią naszej sieci partnerskiej. Poniżej znajdziesz wszystkie szczegóły.</p>
    ${login_email && login_password ? credentialsBox(login_email, login_password) : ""}
    ${projectsHtml}
    ${offersHtml}
    ${linksHtml ? linkBox(linksHtml) : ""}
    ${!projectsHtml && !offersHtml ? `<p style="margin:16px 0;">✨ Dziękujemy za dołączenie do naszej sieci partnerskiej! Wkrótce prześlemy Ci szczegóły współpracy.</p>` : ""}
    ${ctaButton("🚀 Zaloguj się do panelu", loginUrl)}
    <p style="text-align:center;margin:8px 0 0;font-size:13px;color:#9ca3af;">Powodzenia! 🚀</p>`);
    }

    // ── OFFER ──
    else if (email_type === "offer") {
      if (!offer_id) {
        return new Response(JSON.stringify({ error: "offer_id wymagane" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const offer = await fetchOffer(offer_id);
      if (!offer) {
        return new Response(JSON.stringify({ error: "Oferta nie znaleziona" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const priceStr = offer.price ? `${Number(offer.price).toLocaleString("pl-PL")} PLN` : "do uzgodnienia";
      const areaStr = offer.area_m2 ? `${offer.area_m2} m²` : "";
      const commStr = offer.commission_type === "percent" && offer.commission_percent
        ? `${offer.commission_percent}%`
        : offer.commission_amount ? `${Number(offer.commission_amount).toLocaleString("pl-PL")} PLN` : "";

      const offerRow = (icon: string, label: string, value: string) =>
        `<tr><td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151;font-size:14px;width:40%;">${icon} ${label}</td><td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;">${value}</td></tr>`;

      emailBody = wrapper(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 16px;">📋 Mamy dla Ciebie <strong>nową ofertę współpracy</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      ${offerRow("🏠", "Nazwa", offer.name)}
      ${offer.city ? offerRow("📍", "Miasto", offer.city) : ""}
      ${offer.address ? offerRow("🗺️", "Adres", offer.address) : ""}
      ${offerRow("💰", "Cena", priceStr)}
      ${areaStr ? offerRow("📐", "Powierzchnia", areaStr) : ""}
      ${commStr ? offerRow("🤑", "Prowizja", `<strong style="color:#059669;">${commStr}</strong>`) : ""}
    </table>
    ${offer.description ? `<p style="margin:12px 0;color:#4b5563;font-size:14px;line-height:1.6;">${offer.description}</p>` : ""}
    ${linksHtml ? linkBox(linksHtml) : ""}
    ${ctaButton("🤝 Zainteresowany? Odpisz!")}`);
    }

    // ── GENERAL ──
    else if (email_type === "general") {
      const partnerOffers = await fetchPartnerOffers();
      const allProjects = await fetchPartnerProjects();

      const offersHtml = partnerOffers.length > 0
        ? sectionBox("📋", "Aktualnie współpracujesz z nami przy", partnerOffers.map(o => `<li>${o.name}${o.city ? ` <span style="color:#6b7280;">(${o.city})</span>` : ""}</li>`).join(""))
        : "";
      const projectsHtml = allProjects.length > 0
        ? sectionBox("🏗️", "Twoje inwestycje", allProjects.map(p => `<li>${p.name} <span style="color:#6b7280;">(${(p.cities || []).join(", ")})</span></li>`).join(""))
        : "";

      emailBody = wrapper(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 16px;">💛 Dziękujemy za dotychczasową współpracę z <strong>Brand and Sell</strong>! Cenimy sobie każdego partnera.</p>
    ${offersHtml}
    ${projectsHtml}
    ${linksHtml ? linkBox(linksHtml) : ""}
    ${ctaButton("📩 Potrzebujesz wsparcia? Napisz!")}`);
    }

    // ── FOLLOW-UP ──
    else if (email_type === "follow_up") {
      emailBody = wrapper(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 12px;">🔄 Chcieliśmy się upewnić, że wszystko jest w porządku i sprawdzić, jak idzie współpraca.</p>
    ${custom_message ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fefce8;border-radius:8px;border:1px solid #fde68a;">
      <tr><td style="padding:14px 18px;font-size:14px;color:#92400e;line-height:1.6;">${custom_message}</td></tr>
    </table>` : ""}
    ${linksHtml ? linkBox(linksHtml) : ""}
    ${ctaButton("💬 Daj znać jak Ci idzie!")}`);
    }

    // ── PROPOSAL ──
    else if (email_type === "proposal") {
      if (!custom_message) {
        return new Response(JSON.stringify({ error: "Treść propozycji jest wymagana" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emailBody = wrapper(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 12px;">💡 Mamy dla Ciebie ciekawą propozycję:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:linear-gradient(135deg,#faf5ff,#f3e8ff);border-radius:8px;border:1px solid #d8b4fe;">
      <tr><td style="padding:18px 20px;font-size:14px;color:#581c87;line-height:1.7;">${custom_message}</td></tr>
    </table>
    ${linksHtml ? linkBox(linksHtml) : ""}
    ${ctaButton("🤔 Co myślisz? Odpisz!")}`);
    }

    // ── QUESTION ──
    else if (email_type === "question") {
      if (!custom_message) {
        return new Response(JSON.stringify({ error: "Treść pytania jest wymagana" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emailBody = wrapper(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 12px;">❓ Mamy do Ciebie pytanie:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;border:1px solid #bfdbfe;">
      <tr><td style="padding:18px 20px;font-size:14px;color:#1e3a5f;line-height:1.7;border-left:4px solid #3b82f6;">${custom_message}</td></tr>
    </table>
    ${ctaButton("✉️ Odpowiedz")}`);
    }

    else {
      return new Response(JSON.stringify({ error: "Nieznany typ emaila" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build subject line
    const subjectMap: Record<string, string> = {
      onboard: "Witamy w Brand and Sell! 🚀",
      offer: "Nowa oferta współpracy — Brand and Sell",
      general: "Dziękujemy za współpracę — Brand and Sell",
      follow_up: "Sprawdzamy jak idzie — Brand and Sell",
      proposal: "Propozycja współpracy — Brand and Sell",
      question: "Mamy do Ciebie pytanie — Brand and Sell",
    };
    const emailSubject = subjectMap[email_type] || "Wiadomość od Brand and Sell";

    // Send to Make.com
    const webhookPayload = { email: recipientEmail, email_body: emailBody, email_subject: emailSubject };
    console.log("Sending webhook:", JSON.stringify({ email: recipientEmail, type: email_type, subject: emailSubject }));

    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
      const respText = await resp.text().catch(() => "");
      console.log("Webhook response:", resp.status, respText.slice(0, 300));
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Make.com zwrócił błąd ${resp.status}: ${respText.slice(0, 200)}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      console.error("Webhook error:", e);
      return new Response(JSON.stringify({ error: "Brak połączenia z Make.com: " + String(e) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, email: recipientEmail, email_type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
