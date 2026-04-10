import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMS_WEBHOOK_URL = "https://hook.eu1.make.com/yp2c68m1xp782dmn4biglpul41tout40";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { full_name, email, phone, source, partner_name, offer_name } = body;

    if (!full_name) {
      return new Response(JSON.stringify({ error: "full_name wymagane" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceMap: Record<string, string> = {
      link_afiliacyjny: "link",
      landing_page: "landing page",
      rejestracja_manualna: "panel agenta",
      test_manual: "test",
    };

    const sms_message = `🚨 NOWY LEAD - Brand & Sell!\n👤 ${full_name}\n📞 ${phone || "brak"}\n📧 ${email || "brak"}${partner_name ? `\n🤝 Partner: ${partner_name}` : ""}${offer_name ? `\n🏠 Oferta: ${offer_name}` : ""}\n📍 Źródło: ${sourceMap[source] || source || "nieznane"}`;

    const payload = { sms_message };

    console.log("Sending SMS webhook:", JSON.stringify(payload));

    let result = null;
    try {
      const resp = await fetch(SMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      result = { status: resp.status, ok: resp.ok };
      console.log("SMS webhook sent:", result);
    } catch (e) {
      console.error("SMS webhook error:", e);
      result = { error: String(e) };
    }

    return new Response(JSON.stringify({ success: true, webhook_result: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
