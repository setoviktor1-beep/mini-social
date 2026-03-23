# UX Audito Ataskaita: "Pirkejas" (QA Inžinierius)

**Data:** 2026-03-23
**Objektas:** `app/services/page.tsx`, `app/pro/page.tsx`, `app/auth/`
**Tikslas:** Ieškoti UX akligatvių, kur vartotojas gali įstrigti arba patirti trintį.

---

## 1. Autentifikacijos (Auth) Problemos

### 1.1. Registracijos blokas dėl adreso (`app/auth/register/page.tsx`)
*   **Problema:** Adreso laukas yra privalomas ir naudoja `AddressAutocomplete` (Google Maps).
*   **UX Akligatvis:** Jei vartotojas gyvena naujos statybos name, kurio dar nėra Google žemėlapiuose, jis **negali užsiregistruoti**. Nėra galimybės įvesti adreso rankiniu būdu arba nurodyti tik apytikslę vietą.
*   **Rekomendacija:** Leisti rankinį adreso įvedimą arba praleisti šį žingsnį registracijos metu (nustatant vėliau).

### 1.2. Prisijungimo "įstrigimas" nepatvirtinus el. pašto (`app/auth/login/page.tsx`)
*   **Problema:** Jei vartotojas bando prisijungti su nepatvirtintu el. paštu, gauna klaidą: *"Please confirm your email first"*.
*   **UX Akligatvis:** Nėra mygtuko **"Resend confirmation email"**. Jei vartotojas pametė originalų laišką, jis lieka užblokuotas be aiškaus kelio atgal.
*   **Rekomendacija:** Pridėti galimybę pakartotinai išsiųsti patvirtinimo nuorodą tiesiai iš prisijungimo lango.

---

## 2. Paslaugų Puslapio (Services) Problemos

### 2.1. "Lokacijos kalėjimas" (`app/services/page.tsx`)
*   **Problema:** Jei profilyje nėra adreso, vartotojas mato tik pranešimą "Lokacija nenustatyta" su mygtuku į nustatymus.
*   **UX Akligatvis:** Vartotojas negali net *pamatyti*, kokios paslaugos egzistuoja mieste, kol nenurodo tikslaus savo adreso. Tai atbaido naujus, dar neapsisprendusius vartotojus.
*   **Rekomendacija:** Leisti naršyti paslaugas nurodžius tik miestą arba rodyti paslaugas pagal numatytąją lokaciją (pvz., centro).

### 2.2. "Susisiekti" trintis svečiams
*   **Problema:** `LocalServiceCard` rodo tekstą *"Prisijunkite norėdami užsisakyti"*, jei vartotojas nėra prisijungęs.
*   **UX Akligatvis:** Tai yra tiesiog tekstas, o ne nuoroda. Vartotojas turi pats ieškoti, kur yra prisijungimo puslapis.
*   **Rekomendacija:** Padaryti tekstą nuoroda į `/auth/login`.

### 2.3. Užklausų sekimo trūkumas (Po užsakymo)
*   **Problema:** Paspaudus "Susisiekti", sukuriama žinutė (`messages`), bet nesukuriamas formalus užsakymas, kurį pirkėjas matytų savo sąraše.
*   **UX Akligatvis:** Pirkėjas neturi jokio "Mano užsakymai" lango. Viskas vyksta tik susirašinėjimo forma. Jei pirkėjas išsiunčia 10 užklausų skirtingiems meistrams, jis turi kiekvieną pokalbį tikrinti atskirai, kad sužinotų statusą.
*   **Rekomendacija:** Integruoti `service_requests` būsenų matymą žinučių lange arba sukurti pirkėjo užsakymų istoriją.

---

## 3. Verslo Darbalaukio (PRO) Problemos

### 3.1. Agresyvus peradresavimas (`app/pro/page.tsx`)
*   **Problema:** Jei vartotojas bando pasiekti `/pro`, bet neturi PRO plano, jis iškart nukreipiamas į `/pricing`.
*   **UX Akligatvis:** Vartotojas negauna jokio paaiškinimo, kodėl jis ten atsidūrė (pvz., "Ši funkcija skirta tik meistrams"). Jei jis ką tik apmokėjo, bet Stripe webhook'as vėluoja, jis pateks į peradresavimo ciklą.
*   **Rekomendacija:** Rodyti "Landing page" meistrams su paaiškinimu apie PRO naudą, o ne tiesioginį redirect'ą.

### 3.2. Užklausų atmetimo nebuvimas (`components/pro/RequestBoard.tsx`)
*   **Problema:** Meistras gali tik "Paimti darbą" arba "Pažymėti kaip atliktą".
*   **UX Akligatvis:** Nėra mygtuko **"Atmesti"** arba **"Atšaukti"**. Jei meistras negali atlikti darbo, jis negali jo pašalinti iš savo "Nauji užsakymai" stulpelio formaliai.
*   **Rekomendacija:** Pridėti "Reject" funkciją, kuri pakeistų statusą į `rejected` arba `cancelled`.

### 3.3. Architektūrinis chaosas (Dvigubas Dashboard)
*   **Pastebėjimas:** Egzistuoja `app/pro/page.tsx` (naudojantis `service_requests`) ir `app/pro/dashboard/page.tsx` (naudojantis `orders`).
*   **UX Rizika:** Tai rodo, kad sistema turi dvi lygiagrečias užsakymų logikas. Vartotojas gali matyti skirtingą informaciją priklausomai nuo to, kurią nuorodą paspaudė.
*   **Rekomendacija:** Apjungti abi logikas į vieną standartizuotą užsakymų sistemą.

---

## Išvada
Didžiausia UX rizika yra **ne lankstus registracijos/lokacijos procesas** ir **formalaus užsakymų sekimo trūkumas pirkėjui**. Vartotojas gali lengvai pasimesti tarp žinučių, nežinodamas, ar jo užklausa buvo oficialiai priimta.
