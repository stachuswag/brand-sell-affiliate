import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, description, title, images } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY nie jest skonfigurowany");

    const systemPrompt = `Jesteś ekspertem od tworzenia landing pages dla nieruchomości premium.
Na podstawie opisu/promptu użytkownika generujesz strukturę treści landing page w formacie JSON.
ZAWSZE odpowiadaj WYŁĄCZNIE poprawnym obiektem JSON, bez żadnego tekstu przed ani po, bez bloków markdown (bez \`\`\`json ani \`\`\`).`;

    const userPrompt = `Stwórz landing page dla następującej nieruchomości/oferty:

Tytuł: ${title || "Oferta nieruchomości"}
Opis/Prompt: ${prompt || description || "Luksusowa nieruchomość"}
Liczba zdjęć: ${images?.length || 0}

Zwróć JSON w dokładnie tej strukturze:
{
  "headline": "Główny nagłówek (chwytliwy, max 10 słów)",
  "subheadline": "Podtytuł (max 20 słów)",
  "description": "Rozbudowany opis nieruchomości (3-5 zdań, profesjonalny ton)",
  "features": [
    { "icon": "home", "title": "Cecha 1", "description": "Opis cechy" },
    { "icon": "map-pin", "title": "Cecha 2", "description": "Opis cechy" },
    { "icon": "star", "title": "Cecha 3", "description": "Opis cechy" },
    { "icon": "shield", "title": "Cecha 4", "description": "Opis cechy" }
  ],
  "cta_text": "Tekst przycisku CTA (max 5 słów)",
  "cta_description": "Zachęta do kontaktu (1 zdanie)",
  "theme": "elegant",
  "accent_color": "#b8972c",
  "contact_title": "Tytuł sekcji kontaktowej",
  "contact_description": "Opis zachęcający do wypełnienia formularza (1-2 zdania)",
  "footer_text": "Krótki tekst stopki",
  "benefits": [
    "Korzyść 1",
    "Korzyść 2",
    "Korzyść 3"
  ]
}

Ikony muszą być TYLKO z tej listy: home, map-pin, star, shield, building2, check-circle, users, award, trending-up, key, sun, heart

PAMIĘTAJ: Odpowiedz WYŁĄCZNIE samym obiektem JSON, bez komentarzy i bez markdown.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Nieprawidłowy klucz Anthropic API. Sprawdź konfigurację ANTHROPIC_API_KEY." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Przekroczono limit zapytań Anthropic. Spróbuj ponownie za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 529) {
        return new Response(
          JSON.stringify({ error: "API Anthropic jest przeciążone. Spróbuj ponownie za chwilę." }),
          { status: 529, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Brak środków lub brak dostępu na koncie Anthropic. Doładuj konto na console.anthropic.com." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Błąd Anthropic API: " + response.status);
    }

    const data = await response.json();
    // Anthropic Messages API: content is an array of blocks; text lives in blocks of type "text"
    const raw: string =
      Array.isArray(data?.content)
        ? data.content
            .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
            .map((b: any) => b.text)
            .join("")
        : "";

    // Strip markdown code fences if Claude added them despite instructions
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
    }
    // Fallback: extract first {...} block
    if (!cleaned.startsWith("{")) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) cleaned = match[0];
    }

    let content;
    try {
      content = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error. Raw:", raw);
      throw new Error("Nieprawidłowa odpowiedź AI (nie JSON)");
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
