import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Brak autoryzacji" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Nieautoryzowany" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, partner_name, contact_person, files, link, batch_token } =
      await req.json();

    if (!subject || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "subject and files required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const firstName = (contact_person || partner_name || "Partnerze")
      .split(" ")[0];

    // Generate email text with AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let emailText = "";

    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content:
                    "Jesteś asystentem firmy Brand and Sell (sieć partnerska nieruchomości). Pisz krótkie, profesjonalne maile po polsku. Używaj emotikonów ale z umiarem. Odpowiedz TYLKO treścią maila (2-3 zdania), bez powitania i podpisu - te zostaną dodane automatycznie. Nie używaj HTML.",
                },
                {
                  role: "user",
                  content: `Napisz krótką treść maila informującego partnera o przesłanych plikach. Temat plików: "${subject}". Liczba plików: ${files.length}. Partner może pobrać pliki klikając przycisk w mailu.`,
                },
              ],
              max_tokens: 4096,
              temperature: 0.7,
            }),
          }
        );

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          emailText =
            aiData.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (e) {
        console.error("AI error:", e);
      }
    }

    if (!emailText) {
      emailText = `Przesyłamy pliki dotyczące: ${subject}. Kliknij przycisk poniżej, aby pobrać ${files.length} plik(ów).`;
    }

    // Build download panel URL
    const downloadUrl = batch_token
      ? `https://brand-sell-affiliate.lovable.app/files/${batch_token}`
      : "";

    const fileCountText = files.length === 1
      ? "1 plik"
      : files.length < 5
        ? `${files.length} pliki`
        : `${files.length} plików`;

    const linkHtml = link
      ? `<p style="margin:16px 0 0;font-size:14px;">🔗 Dodatkowy link: <a href="${link}" style="color:#2563eb;text-decoration:underline;">${link}</a></p>`
      : "";

    // Signature
    const signature = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:2px solid #e5e7eb;padding-top:24px;">
        <tr>
          <td style="font-family:Arial,sans-serif;font-size:14px;color:#6b7280;">
            Pozdrawiamy serdecznie 🤝<br>
            <strong style="color:#111827;font-size:15px;">Zespół Brand and Sell</strong><br>
            <span style="font-size:12px;color:#9ca3af;">Twój partner w sprzedaży nieruchomości</span>
          </td>
        </tr>
      </table>`;

    const emailBody = `
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
    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Cześć ${firstName}! 👋</h2>
    <p style="margin:0 0 20px;">${emailText}</p>

    <!-- Files info box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
      <tr><td style="padding:18px 20px;text-align:center;">
        <p style="margin:0 0 4px;font-weight:600;font-size:15px;color:#0369a1;">📁 ${fileCountText} do pobrania</p>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Temat: ${subject}</p>
        ${downloadUrl ? `<a href="${downloadUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#2563eb,#1e40af);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">📥 Pobierz pliki</a>` : ""}
      </td></tr>
    </table>

    ${linkHtml}

    ${signature}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    return new Response(
      JSON.stringify({ email_body: emailBody, email_subject: "Nowe pliki — Brand and Sell" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Nieznany błąd",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
