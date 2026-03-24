import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, description, title, images } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Jesteś ekspertem od tworzenia landing pages dla nieruchomości premium. 
Na podstawie opisu/promptu użytkownika generujesz strukturę treści landing page w formacie JSON.
ZAWSZE odpowiadaj TYLKO poprawnym JSON, bez żadnych komentarzy ani tekstu poza JSON.`;

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

Ikony muszą być TYLKO z tej listy: home, map-pin, star, shield, building2, check-circle, users, award, trending-up, key, sun, heart`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Przekroczono limit zapytań. Spróbuj ponownie za chwilę." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Brak środków na koncie AI. Doładuj konto w ustawieniach." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Błąd AI gateway: " + response.status);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    let content;
    try {
      content = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("Nieprawidłowa odpowiedź AI");
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
