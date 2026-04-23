

# Przypisywanie projektów + boczne menu w panelu agenta

## 1. Partners — szybkie przypisanie projektów po kliknięciu w wiersz

Aktualnie przypisywanie projektów jest dostępne tylko przez przycisk "edytuj" (ołówek), który otwiera pełen formularz partnera. Dodajemy szybszy sposób:

- **Klik w wiersz partnera** (lub w nazwę / dedykowany przycisk "Projekty") otwiera lekki dialog **"Przypisz projekty"** z samą listą projektów (checkboxy).
- Dialog pokazuje nazwę partnera w tytule + listę wszystkich aktywnych projektów z miastami.
- Zapis: `DELETE` + `INSERT` na `partner_projects` (jak teraz w `handleSave`), plus auto-utworzenie linków afiliacyjnych dla nowo dodanych projektów (kopiujemy logikę z `handleSave` w jedno miejsce — pomocnik `syncPartnerProjects`).
- Po zapisie odświeżamy `partnerProjectsMap` i `partners` żeby chipy/grupowanie natychmiast się przeładowały.
- Cały dotychczasowy formularz edycji partnera (pełny dialog) zostaje — tu chodzi tylko o szybką ścieżkę.

**UI**: w tabeli partnerów dodajemy małą ikonkę `Building2` / przycisk "Projekty" w kolumnie akcji + cały wiersz staje się klikalny (pomijamy klik na inne przyciski przez `e.stopPropagation`).

## 2. Agent Dashboard — boczne menu zamiast zakładek poziomych

Aktualnie `src/pages/AgentDashboard.tsx` używa `<Tabs>` z poziomym `TabsList`. Zamieniamy na układ dwukolumnowy podobny do admina:

```text
┌──────────────────────────────────────────┐
│ Stats cards (jak teraz)                  │
├────────────┬─────────────────────────────┤
│ Sidebar    │  Zawartość wybranej sekcji  │
│ • Projekty │                             │
│ • Linki    │                             │
│ • Leady    │                             │
│ • Pliki    │                             │
│ • Partn.   │                             │
└────────────┴─────────────────────────────┘
```

- Lewa kolumna: pionowa lista przycisków (`Briefcase`, `Link2`, `UserCheck`, `FolderOpen`, `Users`) z licznikami w badge'ach. Aktywna pozycja ma akcent (navy/gold).
- Prawa kolumna: aktualnie wybrany panel (zachowujemy całą zawartość obecnych `TabsContent`).
- Stan przez `useState<"projects" | "links" | "contacts" | "files" | "sub-partners">` — bez zmian w logice danych.
- Mobile: sidebar zwija się do poziomego paska scrollowanego (overflow-x-auto) — żeby nie psuć małych ekranów.

## Pliki do edycji

- `src/pages/Partners.tsx` — dodaj `quickProjectsPartner` state + dialog "Przypisz projekty" + helper `syncPartnerProjects(partnerId, ids)`; ikona "Projekty" w wierszu i klikalny wiersz.
- `src/pages/AgentDashboard.tsx` — wymień `<Tabs>` na układ flex z lewym sidebarem nav + prawym panelem. Cała logika (dialogi, fetch) bez zmian.

Bez migracji bazy. Bez zmian w innych plikach.

