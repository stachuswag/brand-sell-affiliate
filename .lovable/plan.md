

# Generowanie landing page przez Claude API

Zamieniamy obecny silnik AI (Lovable AI Gateway → Gemini) w funkcji `generate-landing-page` na bezpośrednie wywołanie **Anthropic Claude API**. Reszta przepływu (UI w `LandingPages.tsx`, zapis do bazy, struktura JSON) pozostaje bez zmian — zmienia się tylko backend edge function.

## Co potrzebuję od Ciebie

**Klucz API Anthropic** — wygenerujesz go w https://console.anthropic.com/settings/keys (zakładka "API Keys" → "Create Key"). Po Twoim potwierdzeniu poproszę o jego dodanie jako sekret `ANTHROPIC_API_KEY` w Lovable Cloud (klucz nie pojawi się w kodzie ani w repozytorium).

## Zmiany techniczne

### 1. Edge Function `supabase/functions/generate-landing-page/index.ts`

- Usunięcie wywołania `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Dodanie wywołania `https://api.anthropic.com/v1/messages`:
  - Header: `x-api-key: ${ANTHROPIC_API_KEY}`, `anthropic-version: 2023-06-01`, `content-type: application/json`
  - Body: `model: "claude-sonnet-4-5-20250929"` (najnowszy Sonnet), `max_tokens: 2000`, `system: <systemPrompt>`, `messages: [{ role: "user", content: <userPrompt> }]`
- Wymuszenie czystego JSON: prompt zostaje zaktualizowany o instrukcję "Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON, bez żadnego tekstu przed/po, bez bloków markdown ` ``` `" + safety parser usuwający ewentualne ` ```json ` wrappery (Claude czasem je dodaje).
- Obsługa błędów Anthropic: 401 (zły klucz), 429 (rate limit), 529 (przeciążenie) — zwracamy czytelne PL komunikaty do toasta w UI.
- Zachowanie całej dotychczasowej struktury JSON odpowiedzi (`headline`, `subheadline`, `features[]`, `cta_text`, theme, kolory, benefits...) — żeby `LandingPages.tsx` i `LandingPageView.tsx` nie wymagały żadnych zmian.

### 2. Wybór modelu

Domyślnie **`claude-sonnet-4-5-20250929`** — najlepszy stosunek jakość/cena dla generowania treści marketingowej. W razie potrzeby można łatwo przełączyć na `claude-opus-4-20250514` (lepsza jakość, droższy) zmieniając jedną stałą w funkcji.

### 3. Bez zmian

- `src/pages/LandingPages.tsx` — wywołuje `supabase.functions.invoke("generate-landing-page", ...)` bez modyfikacji.
- `src/pages/LandingPageView.tsx` — render bez zmian.
- Baza danych, RLS, storage — bez zmian.

## Kolejność wykonania (po zatwierdzeniu)

1. Poproszenie Cię o wklejenie `ANTHROPIC_API_KEY` (sekret).
2. Po dodaniu sekretu — przepisanie `supabase/functions/generate-landing-page/index.ts` na Claude.
3. Auto-deploy edge function.
4. Test: kliknięcie "Generuj AI" w panelu Landing Pages → sprawdzenie wygenerowanego JSON-a w UI.

## Uwagi

- Anthropic API jest płatne per token z Twojego konta na console.anthropic.com (nie jest objęte kredytami Lovable AI). Średnie generowanie LP ~ $0.01–0.03 z modelem Sonnet.
- Klucz pozostaje wyłącznie po stronie edge function (server-side), nigdy nie trafia do przeglądarki.

