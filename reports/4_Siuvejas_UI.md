# UI Audito Ataskaita: Siuvėjas (Frontend ir UI)

Šis auditas sutelktas į mobiliosios versijos (320px) atvaizdavimo kokybę, elementų persidengimą ir „loading“ būsenų trūkumą `components/` kataloge.

## 1. Mobiliosios versijos (320px) atvaizdavimo klaidos

| Komponentas | Klaida | Poveikis | Prioritetas |
| :--- | :--- | :--- | :--- |
| `FinancialSummary.tsx` | Mėnesio navigacijos antraštė per plati (`Finansų suvestinė` + mėnesio pasirinkimas). | Horizontalus persukimas (overflow), netvarkingas vaizdas. | Aukštas |
| `FinancialSummary.tsx` | „Įplaukų“ įvedimo eilutė (`flex` su dviem inputais ir mygtuku). | Elementai susispaudžia iki neįskaitomumo arba išlenda iš rėmų. | Aukštas |
| `ProSettings.tsx` | Darbo valandų pasirinkime naudojamas didelis kairinis tarpas (`pl-13`). | Laiko pasirinkimo laukai mobiliuose ekranuose tampa per maži. | Vidutinis |
| `ProCalendar.tsx` | Kalendoriaus tinklelis (7 stulpeliai) su `p-5` konteineryje. | Celės (40px) yra žemiau rekomenduojamos liečiamo ploto ribos (44px). | Žemas |
| `ProAIChat.tsx` | Fiksuotas `min-h-[500px]` čato konteineriui. | Trumpesniuose ekranuose (pvz., iPhone SE) čatas netelpa į ekraną. | Vidutinis |
| `ProCalendar.tsx` | Įvykio pridėjimo formoje laiko pasirinkimo laukai (`flex gap-2`). | Laukai suspaudžiami, sunku pasirinkti laiką. | Vidutinis |

## 2. Persidengiantys elementai ir išdėstymo problemos

| Komponentas | Problema | Poveikis | Prioritetas |
| :--- | :--- | :--- | :--- |
| `NotificationBell.tsx` | Pranešimų iššokantis langas (`w-80`) mobiliame ekrane (320px). | Langas gali būti „nukirptas“ ekrano krašte, jei nėra centruotas. | Aukštas |
| `Navbar.tsx` | Mobilaus meniu NotificationBell pozicija. | Atidarius pranešimus iš mobilaus meniu, UI gali persidengti su navigacija. | Vidutinis |
| `FeedListClient.tsx` | „Naujas įrašas ↑“ mygtukas (`sticky top-20`). | Gali persidengti su pagrindine navigacija (`sticky top-0`) tam tikrose situacijose. | Žemas |

## 3. Trūkstamos „Loading“ būsenos

| Komponentas | Trūkstama būsena | Vartotojo patirtis | Prioritetas |
| :--- | :--- | :--- | :--- |
| `Navbar.tsx` | Profilio ir pranešimų srities skeletonas. | „Flicker“ efektas (nuo tuščios vietos iki prisijungusio vartotojo). | Vidutinis |
| `FeedListClient.tsx` | Įrašų srauto (feed) skeletonas. | Pradinio užkrovimo metu rodomas tuščias ekranas arba „Loading“ tekstas. | Aukštas |
| `ServicesCatalog.tsx` | Paslaugų sąrašo skeletonas. | Staigus turinio atsiradimas po užkrovimo. | Žemas |
| `ProCalendar.tsx` | Kalendoriaus ir dienos įvykių skeletonas. | Vartotojas nemato, kad duomenys kraunami (tik inicialinis loaderis). | Vidutinis |

## 4. Tema ir Dark Mode neatitikimai

| Komponentas | Problema | Poveikis | Prioritetas |
| :--- | :--- | :--- | :--- |
| `WalletCard.tsx` | Nėra „Dark Mode“ palaikymo (naudojamos fiksavotos `bg-white`, `text-gray-900` klasės). | Tamsioje temoje ši kortelė akina vartotoją ir atrodo neetiškai. | Aukštas |

## Rekomendacijos:
1. **FinancialSummary.tsx**: Pakeisti `flex` į `flex-col` mobiliuose įrenginiuose antraštei ir įvedimo laukams.
2. **WalletCard.tsx**: Pridėti `dark:` klases (`dark:bg-gray-900`, `dark:text-gray-100`, `dark:border-gray-800`).
3. **Loading States**: Implementuoti `Skeleton` komponentus svarbiausiems sąrašams (Feed, Services, Calendar).
4. **Touch Targets**: Užtikrinti, kad visi interaktyvūs elementai mobiliuose ekranuose būtų bent 44x44px ploto (ypač `AddressAutocomplete` ir `Pagination`).

---
*Ataskaitą parengė: Siuvėjas (Frontend/UI Engineer)*
