
## System Linków Afiliacyjnych — Brand and Sell

### Cel systemu
Dyrektor Brand and Sell tworzy linki afiliacyjne dla firm partnerskich (np. Uniestates). Partnerzy wstawiają te linki w swoje materiały. Gdy klient wejdzie przez link i wypełni formularz kontaktowy, Brand and Sell dostaje powiadomienie i może śledzić skąd przyszedł klient. Finalną transakcję dyrektor oznacza ręcznie.

---

### 1. Ekran logowania + autoryzacja
- Logowanie emailem/hasłem (Lovable Cloud / Supabase Auth)
- Role: **admin** (dyrektor Brand and Sell) i **pracownik** (zespół Brand and Sell)
- Tylko admin może tworzyć linki i zarządzać partnerami

---

### 2. Dashboard — strona główna po zalogowaniu
- Liczniki: łączne linki, kontakty z tego miesiąca, transakcje potwierdzone
- Lista ostatnich kontaktów (kto, skąd, kiedy)
- Powiadomienia: nowe kontakty przez link afiliacyjny wyświetlane w górnym pasku

---

### 3. Zarządzanie Partnerami
- Dodaj firmę partnerską: nazwa, osoba kontaktowa, email, telefon, notatki
- Lista wszystkich partnerów z liczbą ich aktywnych linków i wynikami (kontakty, sprzedaże)

---

### 4. Tworzenie i zarządzanie linkami afiliacyjnymi
Dwa typy linków:
- **Link per firma partnerska** — ogólny link dla Uniestates (do wszystkich nieruchomości)
- **Link per oferta** — konkretna nieruchomość + firma partnerska

Każdy link zawiera:
- Wybór partnera (np. Uniestates)
- Opcjonalnie: nazwa/adres nieruchomości
- Docelowy URL (formularz kontaktowy lub strona Brand and Sell — do uzupełnienia później)
- Unikalny kod śledzący (np. `brandsell.pl/c/UNIEST-OFERTA123`)
- Status: aktywny / nieaktywny
- Data ważności (opcjonalnie)

Wygenerowany link można skopiować jednym kliknięciem i wysłać partnerowi.

---

### 5. Strona przekierowująca / tracking
- Gdy klient kliknie link afiliacyjny → system rejestruje kliknięcie (skąd, kiedy, jakiego urządzenia) → przekierowuje na docelowy URL (formularz lub strona Brand and Sell)
- Formularz kontaktowy (opcjonalny — jeśli Brand and Sell nie ma własnego) zbiera: imię, email, telefon, wiadomość — i przypisuje do linku afiliacyjnego

---

### 6. Rejestr kontaktów / leadów
- Tabela wszystkich kontaktów z filtrami: po partnerze, po nieruchomości, po dacie
- Każdy kontakt pokazuje: imię klienta, dane, przez jaki link przyszedł, firma partnerska, nieruchomość
- Status kontaktu: Nowy → W trakcie → Transakcja zawarta / Brak transakcji
- Dyrektor ręcznie oznacza transakcję jako "zawartą" i wpisuje wartość (kwota prowizji dla partnera)

---

### 7. Raporty i prowizje
- Zestawienie per partner: ile kontaktów, ile transakcji, łączna kwota prowizji do wypłaty
- Filtr po przedziale czasowym
- Export do CSV

---

### 8. Powiadomienia
- Nowy kontakt przez link → powiadomienie w aplikacji (badge na dzwonku) + opcjonalnie email do dyrektora
- Historia powiadomień

---

### Technologie backendowe
- **Supabase** (Lovable Cloud): baza danych, autentykacja, row-level security
- Tabele: `partners`, `affiliate_links`, `link_clicks`, `contacts`, `transactions`, `user_roles`
