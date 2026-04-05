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
    const CLAY_API_KEY = Deno.env.get("CLAY_API_KEY");
    if (!CLAY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "CLAY_API_KEY nie jest skonfigurowany" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Brak autoryzacji" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin
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
        JSON.stringify({ error: "Tylko admin może wzbogacać dane" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { partner_id, name, email, linkedin_url, city } = await req.json();

    if (!partner_id) {
      return new Response(
        JSON.stringify({ error: "partner_id jest wymagany" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Clay's People Enrichment API
    // Clay API: POST https://api.clay.com/v3/people/enrich
    const clayPayload: Record<string, string> = {};
    if (name) clayPayload.name = name;
    if (email) clayPayload.email = email;
    if (linkedin_url) clayPayload.linkedin_url = linkedin_url;
    if (city) clayPayload.city = city;

    console.log("Enriching partner via Clay:", { partner_id, clayPayload });

    const clayResponse = await fetch("https://api.clay.com/v3/people/enrich", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clayPayload),
    });

    let enrichedData: Record<string, unknown> = {};

    if (clayResponse.ok) {
      enrichedData = await clayResponse.json();
      console.log("Clay enrichment result:", enrichedData);
    } else {
      const errorText = await clayResponse.text();
      console.error("Clay API error:", clayResponse.status, errorText);

      // Still update partner with what we have, but note the error
      enrichedData = { _clay_error: `Clay API returned ${clayResponse.status}: ${errorText}` };
    }

    // Use Lovable AI to generate icebreaker based on enriched data
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let icebreaker = "";
    let summary = "";

    if (LOVABLE_API_KEY && name) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Jesteś ekspertem od networking w branży nieruchomości. Na podstawie danych o agencie, napisz:
1. "icebreaker" - jedno zdanie na rozpoczęcie rozmowy telefonicznej (naturalny, ciepły ton, nawiązujący do osiągnięć/specjalizacji agenta)
2. "summary" - krótka notatka (2-3 zdania) o profilu agenta, przydatna przed telefonem

Odpowiedz w JSON: {"icebreaker": "...", "summary": "..."}`
              },
              {
                role: "user",
                content: `Agent: ${name}\nMiasto: ${city || "nieznane"}\nEmail: ${email || "brak"}\nLinkedIn: ${linkedin_url || "brak"}\nDane Clay: ${JSON.stringify(enrichedData)}`
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            icebreaker = parsed.icebreaker || "";
            summary = parsed.summary || "";
          }
        }
      } catch (aiError) {
        console.error("AI icebreaker error:", aiError);
      }
    }

    // Update partner with enriched data
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updatePayload: Record<string, unknown> = {
      clay_enriched_at: new Date().toISOString(),
    };

    if (icebreaker) updatePayload.clay_icebreaker = icebreaker;
    if (summary) updatePayload.clay_summary = summary;

    // Extract social data from Clay response
    const clayData = enrichedData as Record<string, unknown>;
    if (clayData.linkedin_url) updatePayload.linkedin_url = clayData.linkedin_url;
    if (clayData.instagram_url) updatePayload.instagram_url = clayData.instagram_url;
    if (clayData.instagram_followers) updatePayload.instagram_followers = clayData.instagram_followers;
    if (clayData.email && !email) updatePayload.email = clayData.email;
    if (clayData.phone) updatePayload.phone = clayData.phone;

    const { error: updateError } = await adminClient
      .from("partners")
      .update(updatePayload)
      .eq("id", partner_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Błąd aktualizacji partnera" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        enriched: updatePayload,
        clay_raw: enrichedData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Clay enrich error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
