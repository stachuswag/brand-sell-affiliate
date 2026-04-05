import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://hook.eu1.make.com/s5gdycilxh42vrzsbtvqidgttzgyx0go";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Brak autoryzacji" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Nieautoryzowany" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Tylko admin może onboardować agentów" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { partner_id, project_id } = await req.json();

    if (!partner_id || !project_id) {
      return new Response(
        JSON.stringify({ error: "partner_id i project_id są wymagane" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch partner data
    const { data: partner, error: partnerError } = await adminClient
      .from("partners")
      .select("*")
      .eq("id", partner_id)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: "Partner nie znaleziony" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!partner.email) {
      return new Response(
        JSON.stringify({ error: "Partner nie ma przypisanego adresu email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch project data
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Projekt nie znaleziony" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all projects assigned to this partner
    const { data: partnerProjects } = await adminClient
      .from("partner_projects")
      .select("project_id")
      .eq("partner_id", partner_id);

    const allProjectIds = [...new Set([
      project_id,
      ...(partnerProjects || []).map((pp: { project_id: string }) => pp.project_id),
    ])];

    let allProjects: Array<{ id: string; name: string; cities: string[]; materials_folder_url: string | null }> = [];
    if (allProjectIds.length > 0) {
      const { data: prjs } = await adminClient
        .from("projects")
        .select("id, name, cities, materials_folder_url")
        .in("id", allProjectIds);
      allProjects = prjs || [];
    }

    // Fetch affiliate links for this partner
    const { data: links } = await adminClient
      .from("affiliate_links")
      .select("tracking_code, destination_url, landing_page_id, project_id")
      .eq("partner_id", partner_id)
      .eq("is_active", true);

    // Fetch landing pages
    const landingPageIds = (links || []).map((l: { landing_page_id: string | null }) => l.landing_page_id).filter(Boolean);
    let landingPages: Array<{ id: string; title: string; slug: string | null }> = [];
    if (landingPageIds.length > 0) {
      const { data: lps } = await adminClient
        .from("landing_pages")
        .select("id, title, slug")
        .in("id", landingPageIds);
      landingPages = lps || [];
    }

    // Update partner status
    await adminClient
      .from("partners")
      .update({ agent_status: "approved" })
      .eq("id", partner_id);

    // Assign partner to project
    await adminClient
      .from("partner_projects")
      .upsert(
        { partner_id, project_id },
        { onConflict: "partner_id,project_id" }
      );

    // Build personalized email body
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "").replace("https://", "");
    const appUrl = `https://${baseUrl}`;

    const partnerName = partner.contact_person || partner.name;
    const firstName = partnerName.split(" ")[0];

    // Build projects section
    const projectsSection = allProjects.map((p) => {
      const cities = p.cities?.length ? p.cities.join(", ") : "—";
      const materialsLink = p.materials_folder_url
        ? `<br>📁 <a href="${p.materials_folder_url}">Materiały marketingowe</a>`
        : "";
      return `<li><strong>${p.name}</strong> (${cities})${materialsLink}</li>`;
    }).join("\n");

    // Build links section
    const linksSection = (links || []).map((l: { tracking_code: string; destination_url: string | null }) => {
      const url = `${appUrl}/c/${l.tracking_code}`;
      return `<li>🔗 <a href="${url}">${url}</a></li>`;
    }).join("\n");

    // Build landing pages section
    const lpSection = landingPages.map((lp) => {
      const url = lp.slug ? `${appUrl}/lp/${lp.slug}` : null;
      return url ? `<li>🌐 <a href="${url}">${lp.title}</a></li>` : "";
    }).filter(Boolean).join("\n");

    const emailBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2>Cześć ${firstName}! 👋</h2>
  
  <p>Miło nam poinformować, że Twoje konto partnera w <strong>Brand and Sell</strong> zostało aktywowane!</p>
  
  <p>Zostałeś przypisany do następujących inwestycji:</p>
  <ul>
    ${projectsSection}
  </ul>

  ${linksSection ? `
  <p><strong>Twoje unikalne linki afiliacyjne:</strong></p>
  <ul>
    ${linksSection}
  </ul>
  <p style="font-size: 13px; color: #666;">Każde kliknięcie i kontakt z tych linków jest automatycznie przypisany do Ciebie.</p>
  ` : ""}

  ${lpSection ? `
  <p><strong>Landing pages:</strong></p>
  <ul>
    ${lpSection}
  </ul>
  ` : ""}

  <p>Jeśli masz pytania, odpowiedz na tego maila — jesteśmy do dyspozycji.</p>
  
  <p>Powodzenia! 🚀</p>
  
  <p style="margin-top: 30px;">
    Pozdrawiamy,<br>
    <strong>Zespół Brand and Sell</strong>
  </p>
</div>
`.trim();

    // Send to Make.com webhook: just email + body
    const webhookPayload = {
      email: partner.email,
      email_body: emailBody,
    };

    console.log("Sending webhook to Make.com:", JSON.stringify({ email: partner.email, bodyLength: emailBody.length }));

    let webhookResult = null;
    try {
      const webhookResponse = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
      webhookResult = {
        status: webhookResponse.status,
        ok: webhookResponse.ok,
      };
      console.log("Webhook sent:", webhookResult);
    } catch (webhookError) {
      console.error("Webhook error:", webhookError);
      webhookResult = { error: String(webhookError) };
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: partner.email,
        webhook_result: webhookResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trigger onboard error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
