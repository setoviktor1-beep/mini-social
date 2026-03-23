# AUDIT_CODEX

Data: 2026-03-23  
Tikslai: `mini-social-mvp.vercel.app` + katalogo `/root/Documents/projektai/mini-social` kodas

Pastaba apie metodiką:
- Gyva svetainė tikrinta per HTTP atsakus ir HTML išvestį.
- Kodo auditui naudota repo analizė ir migracijų peržiūra.
- Pilnas mobilių ekranų vizualinis renderinimas per Playwright nebuvo atliktas, nes šioje aplinkoje nebuvo įdiegtų naršyklių; todėl mobilios UI išvados paremtos realiu HTML/CSS ir komponentų struktūra.

## 1. UI/UX ir vartojimo patirtis

### Svarbi🟡
- Naujam vartotojui onboarding labai silpnas: pagrindinis puslapis neprisijungusiam rodo tik tekstą `Sign in to join the conversation.`, bet nepateikia aiškaus CTA, paaiškinimo ką čia galima veikti ar kaip pradėti. Tai ypač bloga pirmajam vizitui. Įrodymai: `app/page.tsx:145-150`.
- Kalbų ir kopijos konsistencija išardyta visame produkte: vienur LT, kitur EN, o kai kur maišoma tame pačiame ekrane (`Home`, `Inbox`, `Contact`, `Privacy`, `Terms`, `Discussions`, `Explore`, `Alerts`). Tai mažina pasitikėjimą ir atrodo kaip nebaigtas MVP. Įrodymai: `app/layout.tsx:66-78`, `components/BottomNav.tsx:56-62`, gyva `/legal/contact`, gyva `/pricing`.
- „Apsaugoti“ puslapiai (`/messages`, `/settings`) viešai grąžina `200 OK` ir net yra `PRERENDER`, todėl neprisijungęs vartotojas pirmiausia gauna pilną shell/skeleton ir tik po to klientinį peradresavimą. Tai bloga UX ir klaidina naudotoją. Įrodymai: gyvi HTTP atsakai į `/messages` ir `/settings`, `app/messages/page.tsx:43-49`, `app/settings/page.tsx:100-106`.
- Pro dashboard skirtukai mobiliame turi daug elementų vienoje horizontalioje juostoje ir remiasi `overflow-x-auto`, todėl 320 px pločiu vartotojas priverstas horizontaliai slinkti svarbiausią verslo navigaciją. Tai techniškai ne „page horizontal scroll“, bet prasta mobilioji patirtis. Įrodymai: `components/pro/ProDashboardTabs.tsx:45-65`.

### Maža🟢
- Footer legal nuorodos neturi aiškiai užtikrinto 44 px touch target. Mažame ekrane jos atrodo kaip teksto nuorodos, ne kaip mobilūs valdikliai. Įrodymai: `app/layout.tsx:66-76`.
- OG/meta duomenys viešai naudoja `http://localhost:3000`, todėl dalinimosi nuorodos ir SEO meta atrodo neprodukciškai. Įrodymai: `app/layout.tsx:11-15`, gyvas HTML iš `/` ir `/legal/contact`.
- Kontakto puslapis ir dalis globalių tekstų yra anglų kalba, nors produktas akivaizdžiai orientuotas į LT rinką. Tai ne funkcionalumo klaida, bet dizaino ir komunikacijos konsistencijos spraga. Įrodymai: `app/legal/contact/page.tsx:1-30`.

## 2. Kodo sauga ir API saugumas

### Kritinė🔴
- Vartotojas gali pats siųsti `role` lauką profilio atnaujinime, o repo migracijos turi permissive `Profiles update own` politiką, kuri leidžia atnaujinti savo profilį be rolės apribojimo. `Prevent role self-change` čia neapsaugo, nes egzistuoja kita leidžianti UPDATE politika. Rezultatas: reali privilege escalation rizika iki `master` / `admin` / `pro`, priklausomai nuo DB būsenos. Įrodymai: `app/settings/page.tsx:300-322`, `supabase/migrations/20260211_pay_per_use_wallet.sql:61-72`, `scripts/migration-v2.sql:31-36`.
- Bet kuris prisijungęs vartotojas gali siųsti push pranešimus bet kuriam `userId`, nes `/api/push/notify` tikrina tik ar siuntėjas prisijungęs, bet netikrina ar tas `userId` priklauso pačiam vartotojui ar leidžiamam tikslui. Tai leidžia notifikuoti kitus vartotojus savavališkai. Įrodymai: `app/api/push/notify/route.ts:8-20`, `app/api/push/notify/route.ts:33-66`.
- `/api/push/subscribe` priima savavališką `userId` iš request body ir rašo į `push_subscriptions` per service-role klientą be auth patikros. Tai leidžia vienam vartotojui pririšti savo endpoint prie kito vartotojo ID. Įrodymai: `app/api/push/subscribe/route.ts:4-30`.

### Svarbi🟡
- Middleware saugo tik `/admin`. `messages`, `settings`, `notifications`, `wallet` ir kiti privatūs srautai nėra apsaugoti serverio lygiu. Tai reiškia, kad apsauga remiasi kliento JS peradresavimu, o ne tikru route guard. Įrodymai: `middleware.ts:49-65`.
- Vieši apsaugotų puslapių atsakai yra `200 OK` ir `PRERENDER`, todėl route struktūra viešai pasiekiama ir gali būti indeksuojama/cachinama kaip anoniminis shell. Įrodymai: gyvi `curl -I` atsakai į `/messages`, `/settings`.
- `/api/estimate` naudoja Gemini be autentifikacijos ir be jokio rate limiting. Tai tiesioginis piktnaudžiavimo ir kaštų deginimo paviršius. Įrodymai: `app/api/estimate/route.ts:23-53`.
- Frontendas tiesiogiai įkelia Google Maps JS su `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Tai reiškia, kad jei raktas sukonfigūruotas, jis bus viešas naršyklėje. Toks raktas turi būti labai griežtai apribotas pagal domain/API scope, kitaip tai rizika. Įrodymai: `components/AddressAutocomplete.tsx:27-36`, `components/AddressAutocomplete.tsx:63-71`.
- Darbo kataloge yra `.env.local` su realiais slaptais raktais plaintext formatu. Failas ignoruojamas per `.gitignore`, todėl tai nebūtinai commitinta, bet pati praktika rizikinga lokalioje aplinkoje ir audito požiūriu verta pažymėti. Įrodymai: `.gitignore`, `.env.local`.

### Maža🟢
- Produkciniame kode likę daug `console.error` / `console.warn`. Nematyti akivaizdaus secret dumping, bet operacinės detalės ir klaidų kontekstas vis tiek nuteka į browser/server logus. Įrodymai: įvairūs `app/**` ir `components/**` failai, pvz. `app/api/estimate/route.ts:46-52`, `app/messages/page.tsx:71-74`.

## 3. Vartotojų duomenų privatumas ir izoliacija

### Kritinė🔴
- `service_requests` RLS politika leidžia matyti visus `open` įrašus bet kuriam autentifikuotam vartotojui, ne tik atitinkamo verslo savininkui ar meistrui toje zonoje. Pats komentaras migracijoje tai pripažįsta: `simplified: view all open`. Tai tiesioginis kitų vartotojų užklausų privatumo pažeidimas. Įrodymai: `supabase/migrations/20260320180000_add_nextdoor_features.sql:46-51`.
- `/pro` puslapis užkrauna `service_requests` be papildomo savininko filtro, todėl kartu su aukščiau esančia RLS politika verslo dashboard rodo ne vien to verslo užklausas. Įrodymai: `app/pro/page.tsx:46-50`.

### Svarbi🟡
- Čekių nuotraukoms generuojamas `publicUrl`, t. y. implementacija daro prielaidą, kad `receipts` bucket yra public. Jei bucket tikrai public, čekių privatumas pažeistas. Jei bucket private, ši logika vistiek ydinga, nes saugoma vieša URL nuoroda bus neveikianti. Bet kuriuo atveju privacy modelis netvarkingas. Įrodymai: `app/api/receipts/scan/route.ts:28-40`.
- Finansų ir dalis čekių API saugoma tik pagal auth, bet ne pagal planą. Taigi paprastas autentifikuotas vartotojas gali naudoti Pro finansų endpointus tiesiogiai apeidamas UI blokavimą. Tai nėra tarp-vartotojinis nutekėjimas, bet yra neteisėtas priėjimas prie mokamų privatų funkcijų. Įrodymai: `app/api/finance/settings/route.ts:4-47`, `app/api/finance/income/route.ts:4-45`, `app/api/receipts/route.ts:4-45`.
- Privatumo politika žada duomenų ištrynimą per 30 dienų ir BDAR teisę būti pamirštam, bet kode nerasta jokio self-service paskyros ištrynimo ar duomenų ištrynimo srauto. Įrodymai: `app/legal/privacy/page.tsx:119-139`, repo paieškoje nėra account deletion implementacijos.
- Dėl rolės eskalacijos rizikos vartotojas gali perimti verslo tipo rolę ir taip pasiekti daugiau kitų vartotojų verslo duomenų, nei turėtų. Tai antrinis, bet labai realus privatumo pažeidimo kelias. Įrodymai: `app/settings/page.tsx:300-322`, `scripts/migration-v2.sql:31-36`, `supabase/migrations/20260211_pay_per_use_wallet.sql:61-72`.

### Maža🟢
- Viešai pasiekiami `PRERENDER` shell’ai (`/messages`, `/settings`) neduoda pačių duomenų, bet atskleidžia privačių sričių informacinę struktūrą ir route modelį anoniminiam lankytojui. Įrodymai: gyvi HTTP atsakai.

## 4. Teisinė pusė

### Svarbi🟡
- Kontaktų puslapis naudoja placeholder el. paštą `support@example.com`, nors privatumo politikoje nurodytas `support@minisocial.lt`. Tai teisiškai ir reputaciškai labai bloga: nėra aišku, kur realiai kreiptis dėl BDAR ar pagalbos. Įrodymai: `app/legal/contact/page.tsx:11-20`, `app/legal/privacy/page.tsx:145-152`.
- Nėra atskiros cookie policy ir nėra jokio cookie/banner informavimo, nors naudojami auth cookies per Supabase SSR/middleware. Įrodymai: `middleware.ts:12-39`, `lib/server-supabase.ts`, `lib/supabase/server.ts`, repo paieškoje nėra cookie policy puslapio ar consent UI.
- Nėra refund policy ar aiškaus aprašymo, kas vyksta su apmokėjimais/grąžinimais atšaukus planą. Pricing puslapyje aprašomas tik atšaukimas periodo pabaigoje. Įrodymai: `app/pricing/page.tsx:183-196`, `app/legal/terms/page.tsx:51-63`.
- Finansų funkcijai nėra aiškaus disclaimer, kad tai nėra oficiali buhalterija / profesionali apskaita / mokesčių konsultacija. Tai svarbu dėl teisinės rizikos. Įrodymai: `components/pro/FinancialSummary.tsx`.
- Terms ir pricing nesutampa dėl Enterprise kainos: terms sako `€99,99/mėn.`, pricing sako `€89.99/mėn.`. Tai tiesioginis komercinės informacijos neatitikimas. Įrodymai: `app/legal/terms/page.tsx:55-60`, `app/pricing/page.tsx:48-50`.
- Teisiniuose puslapiuose nėra realių juridinio asmens identifikacinių duomenų: nėra įmonės pavadinimo, kodo, adreso, PVM kodo, atsakingo asmens. Vietoje to vartojama formuluotė „Lietuvoje registruota įmonė“. Įrodymai: `app/legal/terms/page.tsx:16-18`, `app/legal/privacy/page.tsx:16-18`.
- Prisijungimo ir registracijos srautuose nerasta nuorodų į Privatumo politiką / Naudojimo sąlygas ar aiškaus sutikimo teksto. Įrodymai: repo paieškoje `app/auth/**` nerasta `legal/privacy` ar `legal/terms`.

### Maža🟢
- Teisinė navigacija ir kopija iš dalies angliška (`Privacy`, `Terms`, `Contact`), nors teisiniai tekstai LT. Tai mažina profesionalumo įspūdį ir gali klaidinti. Įrodymai: `app/layout.tsx:66-76`.

## 5. Verslo logikos auditas

### Kritinė🔴
- Planų spindulio logika marketinge ir Pro nustatymuose žada `Basic 5 km / Pro 15 km / Enterprise 50 km`, bet Google rezultatų paieška visiems planams yra faktiškai nukirsta iki 5 km, nes radius visada daromas `Math.min(radiusKm * 1000, 5000)`. Vadinasi Pro ir Enterprise realiai negauna žadėto spindulio bent jau Google daliai. Įrodymai: `components/pro/ProDashboardTabs.tsx:132-135`, `components/pro/ProSettings.tsx:41-45`, `app/services/page.tsx:191-199`, `app/api/services/route.ts:21-22`.

### Svarbi🟡
- Enterprise plane marketingas sako `AI chat (neribotai)`, bet API kode Enterprise limitas yra `500` per mėnesį. Tai tiesioginis pažado ir realios logikos neatitikimas. Įrodymai: `app/pricing/page.tsx:55-64`, `app/api/ai/pro-chat/route.ts:7-10`.
- Pricing puslapis žada užsakymų limitus (`Basic 50/mėn`, `Pro 200/mėn`, `Enterprise neriboti`), bet repo nerasta jokio šių mėnesinių limitų enforcement kodo. Tai reiškia, kad limitai šiuo metu atrodo tik marketinginiai. Įrodymai: `app/pricing/page.tsx:17-24`, `app/pricing/page.tsx:37-43`, repo paieškoje nerasta limitų enforcement logikos šioms reikšmėms.
- Pro finansų funkcijos ir dalis receipts funkcijų API lygiu nėra užrakintos pagal planą, nors UI jas rodo kaip Pro/Enterprise. Tai leidžia apeiti planų diferenciaciją tiesiogiai kviečiant API. Įrodymai: `app/api/finance/settings/route.ts:4-47`, `app/api/finance/income/route.ts:4-45`, `app/api/receipts/route.ts:4-45`.
- 14 dienų trial suteikimas matomas checkout route, bet kode nematyti atskiro serverinio mechanizmo, kuris ribotų trial kartojimą tuo pačiu vartotoju, jei Stripe kainų konfigūracija to pati neužtikrina. Tai potenciali verslo logikos skylė. Įrodymai: `app/api/stripe/subscribe/route.ts:57-72`.
- Repo schema yra nepilna ir neatkuriama: naudojamos kritinės lentelės (`subscriptions`, `pro_services`, `orders`, `maps_cache`, `ai_memory`, `agent_config`, `agent_messages`, `ai_usage`, `quick_replies`) neturi migracijų šiame repo. Tai labai bloga būsena audituojamumui ir reiškia, kad reali prod logika gali skirtis nuo repo. Įrodymai: repo paieškoje nerasta šių lentelių `CREATE TABLE` migracijų.

### Maža🟢
- Home ir dalis navigacijos rodo Business/Pro srautus kaip esminę produkto dalį, bet neprisijungusio vartotojo flow nepaaiškina, kuo skiriasi socialinė dalis ir verslo dalis. Tai ne saugumo, o produkto aiškumo problema. Įrodymai: `app/page.tsx`, `components/Navbar.tsx`.

## Bendras vertinimas

Projektas šiuo metu turi kelias kritines problemas, kurios neleidžia jo laikyti saugiu ar pilnai paruoštu produkcijai:
- rolės eskalacijos rizika,
- neteisinga duomenų izoliacija `service_requests`,
- push API piktnaudžiavimo skylės,
- planų/logikos neatitikimai tarp marketingo ir realaus enforcement,
- teisinės informacijos neužbaigtumas ir prieštaravimai.

Jei reikėtų trumpai prioritetizuoti taisymus:
1. Užrakinti rolės keitimą ir peržiūrėti visas `profiles` UPDATE politikas.
2. Sutaisyti `service_requests` RLS ir `/pro` užklausas.
3. Uždaryti `/api/push/notify` ir `/api/push/subscribe` pagal tikrą auth/ownership modelį.
4. Perkelti mokamų funkcijų enforcement iš UI į API/server sluoksnį.
5. Suderinti pricing, terms, trial ir kontaktinę/teisinę informaciją.
