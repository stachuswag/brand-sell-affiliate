

# Usunięcie ofert — tylko projekty (inwestycje)

Upraszczamy system: znikają oferty (offers), zostają tylko projekty inwestycyjne. Panel agenta dostaje rozbudowaną sekcję "Moje projekty".

## Co znika

**Strony / nawigacja:**
- Usunięcie strony `src/pages/Offers.tsx`
- Usunięcie route `/offers` w `src/App.tsx`
- Usunięcie linka "Oferty" z `src/components/AppShell.tsx` (admin nav)
- Usunięcie zakładek "Oferty (przypisane)" i "Moje oferty" w `src/pages/AgentDashboard.tsx`
- Usunięcie `src/components/OfferAttachmentsDialog.tsx`

**Baza danych (migracja):**
- DROP TABLE `offer_attachments`
- DROP TABLE `partner_offers`
- DROP TABLE `offers`
- Usunięcie kolumny `offer_id` z `affiliate_links` (link tylko do projektu)
- Usunięcie kolumny `submitted_by_partner_id` z miejsc gdzie była używana w kontekście ofert
- Storage bucket `offer-files` — pozostawiamy (sam się nie usunie, ale przestaje być używany)

## Co dostaje rozbudowę — "Moje projekty" w panelu agenta

W `src/pages/AgentDashboard.tsx`, zakładka **Moje projekty** pokazuje wyłącznie projekty przypisane do partnera agenta (przez `partner_projects`). Dla każdego projektu karta z:

- Nazwa inwestycji + miasta (badge'y)
- Opis
- Link do folderu materiałów (Google Drive) — jeśli ustawiony
- **Linki afiliacyjne** dla tego projektu (z tabeli `affiliate_links` gdzie `partner_id = mój` i `project_id = ten`) — pełny URL + przycisk "Kopiuj" + licznik kliknięć
- Przycisk **"Zarejestruj leada"** — otwiera dialog (Soft Check + RODO) z prefillem `project_id` i odpowiedniego `affiliate_link_id`
- Liczba leadów z tego projektu (z `contacts` przez `affiliate_links`)

## Co poprawiamy w pozostałych miejscach

- `src/pages/Links.tsx` — usunięcie wszelkich resztek pól `offer_id` / typu `property` (już zrobione wcześniej, dopilnować)
- `src/pages/Contacts.tsx` — w dialogu "Dodaj lead ręcznie" zamiast partnera można opcjonalnie wybrać **projekt** (i partnera), generuje link `partner-projekt-MAN` jeśli brak
- `src/pages/Reports.tsx` — jeśli odwołuje się do `offers`, przepiąć agregacje na `projects`
- `src/pages/SendFiles.tsx` / `EmailCenter.tsx` — sprawdzić czy nie odwołują się do ofert; jeśli tak, usunąć

## Migracja SQL (skrót)

```sql
ALTER TABLE affiliate_links DROP COLUMN offer_id;
DROP TABLE offer_attachments;
DROP TABLE partner_offers;
DROP TABLE offers;
-- enum link_type: zostawiamy 'partner' i 'project' (jeśli istnieje 'property', usunąć z użycia)
```

## Pliki do edycji

- `src/App.tsx` — usuń import i route Offers
- `src/components/AppShell.tsx` — usuń pozycję "Oferty"
- `src/pages/AgentDashboard.tsx` — usuń taby ofert, rozbuduj tab "Moje projekty"
- `src/pages/Contacts.tsx` — przełącz selektor partnera na projekt+partner
- `src/pages/Links.tsx` — sprzątanie po offer_id (jeśli zostało)
- `src/pages/Reports.tsx` — sprzątanie odwołań do ofert
- `src/pages/SendFiles.tsx`, `src/pages/EmailCenter.tsx` — sprzątanie jeśli dotyczy
- DELETE: `src/pages/Offers.tsx`, `src/components/OfferAttachmentsDialog.tsx`
- Nowa migracja SQL w `supabase/migrations/`
- Aktualizacja memory: usunąć `mem://features/offer-management`, zaktualizować `mem://features/projects-management` o rozbudowany agent view

