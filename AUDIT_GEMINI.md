# AUDITO REZULTATAI: MINI SOCIAL MVP

Atliktas pilnas platformos auditas, vertinant UI/UX, saugumą, privatumą, teisinę atitiktį ir verslo logiką.

---

### 1. UI/UX ir vartojimo patirtis

*   **Kritinė🔴 | Dubliuota navigacija namų puslapyje**
    `app/page.tsx` turi savo `nav` elementą (bottom nav), o `app/layout.tsx` įtraukia bendrą `BottomNav.tsx`. Mobiliame įrenginyje namų puslapyje matomos DVI navigacijos juostos viena virš kitos.
*   **Svarbi🟡 | Navigacijos nenuoseklumas (Mobile)**
    `BottomNav.tsx` rodo "Home", tuo tarpu `Navbar.tsx` mobiliame meniu tą patį puslapį vadina "Discussions". Tai painioja vartotoją.
*   **Svarbi🟡 | Trūkstamas "Ištrinti paskyrą" funkcionalumas UI**
    Nors vertimų failuose (`lib/i18n.tsx`) yra raktas `settings.deleteAccount`, pačiame nustatymų puslapyje (`app/settings/page.tsx`) šio mygtuko nėra. Vartotojas neturi galimybės pats pašalinti paskyros.
*   **Svarbi🟡 | Dizaino nesutapimai tarp "Home" ir vidinių puslapių**
    Namų puslapis (`app/page.tsx`) naudoja `w-screen` ir neigiamas paraštes (`-ml-[50vw]`), kas gali sukelti horizontalaus slinkimo (horizontal scroll) problemų tam tikrose naršyklėse, kai kiti puslapiai laikosi standartinio konteinerio.
*   **Maža🟢 | Placeholder informacija kontaktuose**
    `app/legal/contact/page.tsx` vis dar rodo `support@example.com` ir prašo "pakeisti į tikrą el. paštą".
*   **Maža🟢 | Touch targets**
    Dauguma mygtukų atitinka 44px reikalavimą, tačiau kai kurie filtrai (`app/services/page.tsx` kategorijų mygtukai) mobiliame ekrane yra arti vienas kito.

---

### 2. Kodo sauga ir API saugumas

*   **Kritinė🔴 | Nesaugus pranešimų siuntimas (Potential Spam)**
    Nors pranešimų (notifications) įrašymo politika buvo sugriežtinta (`20260214220000_restrict_notifications_insert_policy.sql`), vis dar nėra greičio ribojimo (rate limiting) pranešimams per API, kas leidžia autentifikuotam vartotojui automatizuotai spaminti kitus vartotojus.
*   **Svarbi🟡 | Middleware saugo tik /admin maršrutus**
    `middleware.ts` tikrina tik `/admin` kelius. Nors `/messages`, `/settings`, `/wallet` puslapiai turi vidinius `auth` tikrinimus, geriausia praktika būtų juos apsaugoti middleware lygiu, kad nebūtų kraunamas joks kodas neautorizuotiems vartotojams.
*   **Maža🟢 | Console.error naudojimas produkcijoje**
    Daugelyje vietų (pvz., `lib/feed-service.ts`, `app/api/ai/pro-chat/route.ts`) naudojamas `console.error`. Tai nėra saugumo spraga, bet geriau naudoti centralizuotą logging sistemą.

---

### 3. Vartotojų duomenų privatumas ir izoliacija

*   **Kritinė🔴 | GDPR - "Teisė būti pamirštam"**
    Nėra jokio automatinio būdo vartotojui ištrinti savo duomenis (paskyrą). Tai tiesioginis GDPR pažeidimas.
*   **Svarbi🟡 | API prieiga prie kitų vartotojų profilių**
    Nors RLS apsaugo jautrius duomenis, kai kurie API endpointai grąžina per plačią profilio informaciją (pvz., `working_hours` viešai prieinama per `profiles` lentelę visiems).
*   **Maža🟢 | Čekių nuotraukos Storage**
    Reikia įsitikinti, kad `post-images` bucket'e esantys `avatars/` ir `receipts/` (jei ten saugomi) katalogai turi griežtas RLS politikas, ne tik public access.

---

### 4. Teisinė pusė

*   **Kritinė🔴 | Trūkstama Slapukų politika (Cookie Policy)**
    Nėra jokio puslapio ar informacinio pranešimo apie naudojamus slapukus, nors naudojama `Supabase Auth` (cookies) ir `Stripe`.
*   **Svarbi🟡 | Trūkstama Grąžinimo politika (Refund Policy)**
    Naudojimo sąlygose minima prenumeratos atšaukimas, bet nėra aiškiai aprašyta refund procedūra, kas privaloma pagal ES vartotojų teisių direktyvas.
*   **Maža🟢 | Placeholder el. paštas**
    Kaip minėta UI dalyje, kontaktuose esantis `support@example.com` turi būti pakeistas.

---

### 5. Verslo logikos auditas

*   **Kritinė🔴 | Užsakymų limitai neenforcinami (Business Logic Fail)**
    "Basic" planas sako "Iki 50 užsakymų/mėn", tačiau `app/api/orders/create/route.ts` tikrina tik kliento limitą (3 užsakymai per valandą), bet visai netikrina paslaugos teikėjo (proId) plano limitų. Pro vartotojas su Basic planu gali gauti neribotą kiekį užsakymų.
*   **Svarbi🟡 | Spindulio ignoravimas paslaugų paieškoje**
    `app/services/page.tsx` paslaugas filtruoja tik pagal Vartotojo (consumer) spindulį. Jei Paslaugos teikėjas (provider) savo nustatymuose nurodė, kad dirba tik 1km spinduliu, jis vis tiek bus rodomas vartotojui, kuris yra už 5km, jei to vartotojo spindulys yra 5km.
*   **Maža🟢 | AI Chat limitų tikrinimas**
    `app/api/ai/pro-chat/route.ts` tikrina planą, bet limitų (pvz., 100 žinučių/mėn Pro planui) enforcinimas kodo lygyje nėra akivaizdus - tikrinamas tik plano egzistavimas.
