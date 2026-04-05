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
    if (!partner.email) {
      return new Response(JSON.stringify({ error: "Partner nie ma emaila" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const partnerName = partner.contact_person || partner.name;
    const firstName = partnerName.split(" ")[0];

    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "").replace("https://", "");
    const appUrl = `https://${baseUrl}`;

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
  <p style="margin-top: 30px;">
    Pozdrawiamy,<br>
    <strong>Zespół Brand and Sell</strong>
  </p>
</div>`;

    const header = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">`;

    // ── ONBOARD ──
    if (email_type === "onboard") {
      // Update status
      await adminClient.from("partners").update({ agent_status: "approved" }).eq("id", partner_id);

      // Assign to project if provided
      if (project_id) {
        await adminClient.from("partner_projects")
          .upsert({ partner_id, project_id }, { onConflict: "partner_id,project_id" });
      }

      const allProjects = await fetchPartnerProjects();
      const partnerOffers = await fetchPartnerOffers();

      const projectsHtml = allProjects.length > 0
        ? allProjects.map((p) => {
            const cities = p.cities?.length ? p.cities.join(", ") : "—";
            const mat = p.materials_folder_url ? `<br>📁 <a href="${p.materials_folder_url}">Materiały</a>` : "";
            return `<li><strong>${p.name}</strong> (${cities})${mat}</li>`;
          }).join("\n")
        : "";

      const offersHtml = partnerOffers.length > 0
        ? partnerOffers.map((o: { name: string; city?: string | null }) =>
            `<li>${o.name}${o.city ? ` (${o.city})` : ""}</li>`
          ).join("\n")
        : "";

      emailBody = `${header}
  <h2>Cześć ${firstName}! 👋</h2>
  <p>Miło nam poinformować, że Twoje konto w <strong>Brand and Sell</strong> zostało aktywowane!</p>
  ${projectsHtml ? `<p>Twoje inwestycje:</p><ul>${projectsHtml}</ul>` : ""}
  ${offersHtml ? `<p>Przypisane oferty:</p><ul>${offersHtml}</ul>` : ""}
  ${linksHtml ? `<p><strong>Twoje linki afiliacyjne:</strong></p><ul>${linksHtml}</ul>
  <p style="font-size:13px;color:#666;">Każde kliknięcie jest automatycznie przypisane do Ciebie.</p>` : ""}
  ${!projectsHtml && !offersHtml ? `<p>Dziękujemy za dołączenie do naszej sieci partnerskiej!</p>` : ""}
  <p>Pytania? Odpisz na tego maila.</p>
  <p>Powodzenia! 🚀</p>
${signature}`; 
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

      emailBody = `${header}
  <h2>Cześć ${firstName}! 👋</h2>
  <p>Mamy dla Ciebie nową ofertę współpracy:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Nazwa</td><td style="padding:8px;border:1px solid #ddd;">${offer.name}</td></tr>
    ${offer.city ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Miasto</td><td style="padding:8px;border:1px solid #ddd;">${offer.city}</td></tr>` : ""}
    ${offer.address ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Adres</td><td style="padding:8px;border:1px solid #ddd;">${offer.address}</td></tr>` : ""}
    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Cena</td><td style="padding:8px;border:1px solid #ddd;">${priceStr}</td></tr>
    ${areaStr ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Powierzchnia</td><td style="padding:8px;border:1px solid #ddd;">${areaStr}</td></tr>` : ""}
    ${commStr ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Prowizja</td><td style="padding:8px;border:1px solid #ddd;">${commStr}</td></tr>` : ""}
  </table>
  ${offer.description ? `<p>${offer.description}</p>` : ""}
  ${linksHtml ? `<p><strong>Twój link afiliacyjny:</strong></p><ul>${linksHtml}</ul>` : ""}
  <p>Zainteresowany? Odpisz na tego maila.</p>
${signature}`;
    }

    // ── GENERAL (thank you) ──
    else if (email_type === "general") {
      const partnerOffers = await fetchPartnerOffers();
      const allProjects = await fetchPartnerProjects();

      const offersHtml = partnerOffers.length > 0
        ? `<p>Aktualnie współpracujesz z nami przy:</p><ul>${partnerOffers.map(o => `<li>${o.name}${o.city ? ` (${o.city})` : ""}</li>`).join("")}</ul>`
        : "";
      const projectsHtml = allProjects.length > 0
        ? `<p>Twoje inwestycje:</p><ul>${allProjects.map(p => `<li>${p.name} (${(p.cities || []).join(", ")})</li>`).join("")}</ul>`
        : "";

      emailBody = `${header}
  <h2>Cześć ${firstName}! 👋</h2>
  <p>Dziękujemy za dotychczasową współpracę z <strong>Brand and Sell</strong>!</p>
  ${offersHtml}
  ${projectsHtml}
  ${linksHtml ? `<p><strong>Twój link afiliacyjny:</strong></p><ul>${linksHtml}</ul>` : ""}
  <p>Jeśli masz pytania lub potrzebujesz wsparcia — jesteśmy do dyspozycji.</p>
${signature}`;
    }

    // ── FOLLOW-UP ──
    else if (email_type === "follow_up") {
      emailBody = `${header}
  <h2>Cześć ${firstName}! 👋</h2>
  <p>Chcieliśmy się upewnić, że wszystko jest w porządku i sprawdzić, jak idzie współpraca.</p>
  ${custom_message ? `<p>${custom_message}</p>` : ""}
  ${linksHtml ? `<p>Przypominamy — Twój link afiliacyjny:</p><ul>${linksHtml}</ul>` : ""}
  <p>Daj znać, jeśli potrzebujesz czegokolwiek!</p>
${signature}`;
    }

    // ── PROPOSAL ──
    else if (email_type === "proposal") {
      if (!custom_message) {
        return new Response(JSON.stringify({ error: "Treść propozycji jest wymagana" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emailBody = `${header}
  <h2>Cześć ${firstName}! 👋</h2>
  <p>Mamy dla Ciebie propozycję:</p>
  <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0;">
    ${custom_message}
  </div>
  ${linksHtml ? `<p>Twój link afiliacyjny:</p><ul>${linksHtml}</ul>` : ""}
  <p>Co myślisz? Czekamy na odpowiedź!</p>
${signature}`;
    }

    // ── QUESTION ──
    else if (email_type === "question") {
      if (!custom_message) {
        return new Response(JSON.stringify({ error: "Treść pytania jest wymagana" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emailBody = `${header}
  <h2>Cześć ${firstName}! 👋</h2>
  <p>Mamy do Ciebie pytanie:</p>
  <div style="background:#f0f7ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #3b82f6;">
    ${custom_message}
  </div>
  <p>Będziemy wdzięczni za szybką odpowiedź.</p>
${signature}`;
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
    const webhookPayload = { email: partner.email, email_body: emailBody, email_subject: emailSubject };
    console.log("Sending webhook:", JSON.stringify({ email: partner.email, type: email_type, subject: emailSubject }));

    let webhookResult = null;
    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
      webhookResult = { status: resp.status, ok: resp.ok };
      console.log("Webhook sent:", webhookResult);
    } catch (e) {
      console.error("Webhook error:", e);
      webhookResult = { error: String(e) };
    }

    return new Response(JSON.stringify({ success: true, email: partner.email, email_type, webhook_result: webhookResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
