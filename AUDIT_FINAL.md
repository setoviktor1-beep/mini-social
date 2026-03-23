# AUDIT_FINAL.md (Konsoliduotas Trijų Agentų Auditas)

Čia pateikiamas nepriklausomas Gemini, Codex ir Claude auditų apibendrinimas. Tai atspindi esamą "MiniSocial PRO" (mini-social-mvp.vercel.app) būklę.

---

## 🔴 Sutariama (Visi trys rado) -> Būtina taisyti iškart

1.  **Middleware Apsaugos Trūkumas (Saugumas):**
    Visi trys auditoriai pastebėjo, kad `middleware.ts` saugo tik `/admin` puslapius. Kiti privatūs puslapiai (`/messages`, `/settings`, `/wallet`) remiasi tik kliento pusės (React) apsauga. Serveris vis tiek atiduoda "200 OK" ir bando renderinti puslapį, kas leidžia anonimams matyti puslapių struktūras arba net apeiti UI blokus tiesiogiai per API.
2.  **Duomenų Nutekėjimas (Privatumas):**
    `service_requests` lentelės RLS politika (Row Level Security) leidžia bet kuriam prisijungusiam vartotojui matyti *visas* `open` statuso užklausas. Tai reiškia, kad vartotojas gali matyti svetimus duomenis.
3.  **Teisinės Spragos (Legal):**
    Nėra jokios „Slapukų politikos“ (Cookie Policy / Consent bannerio). Taip pat „Privacy Policy“ nepakankama, o „Contact“ puslapyje paliktas netikras `support@example.com` el. paštas. Nėra galimybės pačiam ištrinti paskyros (GDPR pažeidimas).

---

## 🟡 Du iš trijų rado -> Svarbios problemos

1.  **Kvitų (Receipts) Saugumas (Claude & Codex):**
    Skenuojamų čekių nuotraukos, panašu, laikomos viešame Storage Bucket'e (sugeneruojamas public URL). Finansiniai dokumentai privalo būti "Private" bucket'e su RLS apsauga, kad jų nepamatytų tretieji asmenys.
2.  **Verslo Logikos Melas / Spindulys (Claude & Codex):**
    Planai (Pro/Enterprise) siūlo 15km ir 50km spindulius, tačiau kode Google Places API skambučiai yra suvaržyti ties kietai įkoduotu 2000–5000 metrų spinduliu (`radius=2000` arba `Math.min(radiusKm * 1000, 5000)`). Vartotojas negauna to, už ką moka.
3.  **API Rate Limiting nebuvimas (Gemini & Claude):**
    Vartotojai (ir botai) gali siųsti tūkstančius užklausų į `/api/estimate` (Gemini) ar Push notifikacijas ir taip sudeginti tavo pinigus arba "nulaužti" sistemą.
4.  **Rolės Eskalacija (Codex & Claude):**
    `profiles` lentelės atnaujinimo politikos leidžia vartotojui pačiam (per modifikuotą API request'ą) pasikeisti savo `role` į `master` ar net `admin` ir taip gauti nemokamą prieigą prie PRO funkcijų.

---

## 🟢 Tik vienas rado -> Papildomos pastabos

*   **Push Notifikacijų Pažeidžiamumas (Codex):** `/api/push/subscribe` ir `/api/push/notify` netikrina autentifikacijos pakankamai griežtai, todėl vienas vartotojas gali spaminti kitus prisirišęs prie svetimo ID.
*   **Navigacijos Dubliavimas (Gemini):** Mobiliame vaizde pagrindiniame puslapyje dubliuojasi dvi navigacijos juostos (`BottomNav` ir senoji).
*   **Onboarding'o Trūkumas (Claude):** Naujas vartotojas po registracijos tiesiog numetamas į srautą be jokio paaiškinimo, ką daryti su adresais ar paslaugomis.
*   **Trūkstamos Migracijos (Codex):** Daug lentelių (`subscriptions`, `ai_memory` ir kt.) neturi `CREATE TABLE` komandų Github'o `supabase/migrations` aplanke. Tai reiškia, kad repozitorija neatitinka tavo realios duomenų bazės.

---

## 🚀 TOP 10 PRIORITETŲ (Ką taisyti pirmiausia prieš Launch'ą)

1.  **Ištaisyti Rolės Eskalaciją:** Užrakinti `role`, `plan_type` ir kitus jautrius laukus `profiles` lentelėje, kad klientas negalėtų jų pats pakeisti per API (keisti gali tik Stripe webhookas).
2.  **Užrakinti `service_requests`:** Pataisyti RLS, kad atviras užklausas matytų tik TIKRI, verifikuoti ir apmokėję `master` vartotojai toje zonoje.
3.  **Sutvarkyti Middleware Apsaugą:** Apsaugoti `/messages`, `/settings`, `/pro` route'us ir atitinkamus API endpointus `middleware.ts` faile.
4.  **Uždaryti Finansų API (Backend'e):** Finansų išlaidų ir pajamų endpointai (`/api/finance/*`) privalo backend'e tikrinti, ar vartotojas turi aktyvų PRO/Enterprise planą (nepasitikėti vien UI paslėpimu).
5.  **Paslėpti Kvitus (Receipts):** Sukurti privatų bucket'ą čekiams ir nenaudoti `getPublicUrl`.
6.  **Išvalyti Teisinius Šablonus:** Pakeisti `example.com`, suderinti Pricing ir Terms kainas ir įdėti paprastą Cookie sutikimo juostą.
7.  **Sutvarkyti Spindulio (Radius) Logiką:** Užtikrinti, kad Google API ir DB užklausos dinamiškai naudotų spindulį iš vartotojo plano, o ne *hardcoded* limitus.
8.  **Pridėti "Delete Account":** Sukurti GDPR reikalaujamą mygtuką, kuris per Supabase RPC funkciją pilnai ištrina vartotoją ir jo nuotraukas.
9.  **Rate Limiting:** Įdėti elementarų limitą (pvz., per Vercel KV) bent jau dirbtinio intelekto ir Push žinučių endpointams.
10. **Push API Saugumas:** Užtikrinti, kad Push prenumeratos (`/api/push/subscribe`) būtų išsaugomos TIK su `auth.uid()`, kad niekas negalėtų siųsti žinučių svetimu vardu.
