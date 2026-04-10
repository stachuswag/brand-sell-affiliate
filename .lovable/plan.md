

## Podsumowanie: Co już mamy vs. co można dodać

### Co już działa (Ścieżka 1 — rejestracja przez link):
- Agent ma indywidualne linki afiliacyjne (`/c/:code`)
- Klient klika link → formularz kontaktowy (imię, email, telefon)
- Dane trafiają do bazy `contacts` z przypisaniem do agenta
- Admin dostaje powiadomienie w aplikacji (in-app)

### Co już działa (Ścieżka 2 — rejestracja manualna):
- Agent loguje się do panelu i może ręcznie dodać klienta
- Kontakt jest przypisywany do agenta automatycznie

---

### Co BRAKUJE i co mogę dodać:

#### 1. Soft Check — weryfikacja duplikatów (Ścieżka 2)
Agent wpisuje imię + 4 ostatnie cyfry telefonu → system sprawdza czy taki kontakt już istnieje w bazie. Jeśli tak — blokada z komunikatem. Jeśli nie — zielone światło i pełny formularz.

**Implementacja:** Nowy krok w dialogu dodawania kontaktu w panelu agenta. Zapytanie do tabeli `contacts` po `full_name ILIKE` + `phone LIKE '%XXXX'`.

#### 2. Checkbox zgody na przetwarzanie danych (Ścieżka 2)
Obowiązkowe oświadczenie agenta o posiadaniu zgody klienta na przekazanie danych — checkbox w formularzu manualnej rejestracji.

**Implementacja:** Dodanie checkboxa do formularza kontaktu w `AgentDashboard.tsx`, blokada przycisku "Wyślij" bez zaznaczenia.

#### 3. Pop-up formularz na stronie oferty (Ścieżka 1)
Zamiast od razu pokazywać formularz, klient widzi stronę/ofertę, a formularz pojawia się jako pop-up (dialog) blokujący dostęp do szczegółów.

**Implementacja:** Modyfikacja `LandingPageView.tsx` — ukrycie szczegółów oferty za dialogiem kontaktowym, który wymaga wypełnienia danych.

#### 4. Powiadomienia SMS do Biura Sprzedaży
Automatyczny SMS do admina po zarejestrowaniu nowego leada (wymaga integracji z Twilio lub Make.com webhook).

**Implementacja:** Rozbudowa triggera `notify_admins_on_contact` lub nowa Edge Function wysyłająca SMS przez Twilio connector / Make.com webhook.

---

### Plan implementacji (po zatwierdzeniu):

| # | Zadanie | Pliki |
|---|---------|-------|
| 1 | Soft Check w panelu agenta (2-krokowy formularz: weryfikacja → pełna rejestracja) | `AgentDashboard.tsx` |
| 2 | Checkbox zgody RODO w formularzu manualnym | `AgentDashboard.tsx` |
| 3 | Pop-up formularz na Landing Page (gate content) | `LandingPageView.tsx` |
| 4 | SMS powiadomienia (Twilio/Make.com) | Nowa Edge Function lub webhook |

Które z tych funkcji chcesz wdrożyć? Mogę zrobić wszystkie naraz lub wybrane.

