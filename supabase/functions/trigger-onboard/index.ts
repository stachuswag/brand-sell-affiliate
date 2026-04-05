import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { partner_id, project_id, webhook_url } = await req.json();

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

    // Fetch affiliate links for this partner + project
    const { data: links } = await adminClient
      .from("affiliate_links")
      .select("tracking_code, destination_url, landing_page_id")
      .eq("partner_id", partner_id)
      .eq("project_id", project_id)
      .eq("is_active", true);

    // Fetch landing pages for these links
    const landingPageIds = (links || [])
      .map(l => l.landing_page_id)
      .filter(Boolean);

    let landingPages: Array<{ id: string; title: string; slug: string | null }> = [];
    if (landingPageIds.length > 0) {
      const { data: lps } = await adminClient
        .from("landing_pages")
        .select("id, title, slug")
        .in("id", landingPageIds);
      landingPages = lps || [];
    }

    // Update partner status to approved
    await adminClient
      .from("partners")
      .update({ agent_status: "approved" })
      .eq("id", partner_id);

    // Assign partner to project if not already
    await adminClient
      .from("partner_projects")
      .upsert(
        { partner_id, project_id },
        { onConflict: "partner_id,project_id" }
      );

    // Build the Make.com webhook payload
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "").replace("https://", "");
    const appUrl = `https://${baseUrl}`;

    const payload = {
      action: "agent_approved",
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        contact_person: partner.contact_person,
        linkedin_url: partner.linkedin_url,
        instagram_url: partner.instagram_url,
      },
      project: {
        id: project.id,
        name: project.name,
        cities: project.cities,
        materials_folder_url: project.materials_folder_url,
      },
      affiliate_links: (links || []).map(l => ({
        tracking_code: l.tracking_code,
        url: `${appUrl}/c/${l.tracking_code}`,
        destination_url: l.destination_url,
      })),
      landing_pages: landingPages.map(lp => ({
        title: lp.title,
        url: lp.slug ? `${appUrl}/lp/${lp.slug}` : null,
      })),
      timestamp: new Date().toISOString(),
    };

    console.log("Onboard payload:", JSON.stringify(payload));

    // Send to Make.com webhook if provided
    let webhookResult = null;
    if (webhook_url) {
      try {
        const webhookResponse = await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        payload,
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
