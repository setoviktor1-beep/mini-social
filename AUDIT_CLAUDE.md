# AUDIT_CLAUDE.md (Ji-woo / Claude Code vertinimas)

## 1. UI/UX ir vartojimo patirtis
*   **Kritinė🔴**: *Onboarding'as* beveik neegzistuoja. Vartotojas po registracijos numetamas į srautą be paaiškinimo, kaip nustatyti lokaciją, nebent bando spausti "Pagalba", kur pamato geltoną klaidą. Reikia onboarding flow (bent 3 žingsnių modalo).
*   **Svarbi🟡**: Mobili navigacija (`BottomNav.tsx`) gali persidengti su kai kuriais formų ar klaviatūros elementais `320px` ekranuose (iPhone SE lygio), jei nėra padaryta `padding-bottom`.
*   **Maža🟢**: Empty states (tuščios būsenos) `/pro` darbalaukyje atrodo gerai, bet trūksta "Call to action" mygtukų (pvz., "Užpildykite pirmą paslaugą"). 

## 2. Kodo sauga ir API saugumas
*   **Kritinė🔴**: Visi slapti raktai iškelti iš `git`, kas yra gerai, BET webhook'e `/api/stripe/webhook/route.ts` naudojamas `SUPABASE_SERVICE_ROLE_KEY`. Būtina užtikrinti, kad šis raktas niekur nebūtų importuojamas į Client komponentus (`"use client"`).
*   **Svarbi🟡**: Rate limiting (Užklausų ribojimas) `api/estimate/route.ts` faile buvo užsimintas, bet reikia įsitikinti, kad jis tikrai blokuoja IP adresą po X užklausų per valandą naudojant Upstash/Redis arba DB lentelę.
*   **Maža🟢**: Middleware apsaugo `/admin`, bet `/pro` puslapis saugomas tik pačiame Server Component'e. Tai saugu (duomenys nenutekės), bet geriau būtų permesti apsaugą į `middleware.ts` greitesniam redirect'ui.

## 3. Vartotojų duomenų privatumas ir izoliacija
*   **Kritinė🔴**: Kvitų skenavimas (Receipts). Jei nuotraukos keliamos į tą patį `post-images` bucket'ą, ir tas bucket'as yra PUBLIC, tai reiškia, kad bet kas turintis URL gali matyti svetimus čekius. Būtina sukurti PRIVATE bucket'ą kvitams (`receipts-bucket`).
*   **Svarbi🟡**: Paslaugų užklausos (Service Requests). RLS politikos leidžia `master_id` ir `client_id` matyti užklausą. Tačiau kai statusas `open`, ją mato visi "master" vartotojai. Reikia patikrinti, ar ten nėra privačios informacijos, kuri nutekėtų kitiems meistrams, prieš jiems "paimant" užsakymą.
*   **Maža🟢**: GDPR ištrynimas - vartotojas gali ištrinti paskyrą, bet ar Supabase kaskadiniu būdu (CASCADE) ištrina ir jo nuotraukas iš Storage bucket'o? Greičiausiai ne, reikia atskiro RPC ar Edge Function tam.

## 4. Teisinė pusė
*   **Kritinė🔴**: Nėra aiškaus Cookie sutikimo (Consent) banerio, atitinkančio ePrivacy direktyvą, jei naudojame Google Places API ir Stripe, kurie seka vartotojus.
*   **Svarbi🟡**: Finansų skiltyje `FinancialSummary.tsx` turi būti labai ryškus "Disclaimer", kad tai nėra oficialus buhalterinis įrankis ir mokesčių dydžiai yra tik orientaciniai.
*   **Maža🟢**: Privacy Policy puslapis egzistuoja, bet turi tiksliai įvardinti, kad duomenys perduodami "Google" (Gemini) ir "Stripe".

## 5. Verslo logikos auditas
*   **Kritinė🔴**: Spindulys (`radius`). Šiuo metu `/api/services/route.ts` API faile įsiūtas kietas kodas (hardcoded) `radius=2000`. Jis nereaguoja į vartotojo planą (Basic/Pro/Enterprise limitus). Būtina dinamiškai paduoti spindulį iš DB profilio.
*   **Svarbi🟡**: 14 dienų bandomasis laikotarpis. Jei vartotojas po 14 dienų nepratęsia, Stripe atsiųs webhook'ą, bet reikia patikrinti, ar jūsų webhook kodas tikrai "atima" `pro` rolę ir grąžina į `user`.
*   **Maža🟢**: Jei `pro` vartotojas tampa `user`, kas nutinka jo jau sukurtiems "Katalogo" paslaugų įrašams? Jie turėtų būti paslepiami, o ne ištrinami.
