Tu esi nepriklausomas auditorius. Atlik pilną auditą pagal žemiau pateiktas sritis. Tikrink mini-social-mvp.vercel.app ir šio katalogo kodą. Būk kritiškas ir objektyvus. Surašyk VISAS rastas problemas - tiek mažas tiek dideles. Rezultatus išsaugok faile. Struktūra: kiekviena sritis atskirai, problemos surikiuotos pagal svarbą (Kritinė🔴 / Svarbi🟡 / Maža🟢)

## AUDITO SRITYS:

### 1. UI/UX ir vartojimo patirtis
- Kiekvienas puslapis mobiliame (320px, 375px, 430px)
- Ar visi elementai telpa be horizontalaus scroll
- Navigacijos nuoseklumas ir logiškumas
- Mygtukų dydžiai (min 44px touch target)
- Tekstų dydžiai ir įskaitomumas
- Empty states, loading states, error messages
- Onboarding - ar naujas vartotojas supranta ką daryti
- Dizaino konsistentiškumas visame projekte

### 2. Kodo sauga ir API saugumas
- Ar API raktai NIEKUR nematomi frontend kode (Google Maps, Gemini, Supabase)
- Ar environment variables teisingai naudojamos (.env.local, ne hardcoded)
- Ar Supabase anon key yra vienintelis viešas - ir ar RLS įjungtas
- Patikrink network tab - ar API užklausose nematomi slapti raktai
- Ar nėra console.log su jautriais duomenimis
- Ar autentifikacija veikia - neautentifikuotas vartotojas negali pasiekti privačių puslapių
- Middleware auth tikrinimas

### 3. Vartotojų duomenų privatumas ir izoliacija
- Ar kiekvienas vartotojas mato TIK savo duomenis (užsakymai, žinutės, finansai)
- Ar Supabase RLS politikos teisingai sukonfigūruotos kiekvienai lentelei
- Ar neįmanoma per URL manipuliaciją pasiekti kito vartotojo duomenis
- Ar žinutės privačios - tik siuntėjas ir gavėjas mato
- Ar verslo darbalaukis matomas tik to verslo savininkui
- Ar čekių nuotraukos privačios Supabase Storage (ne public bucket)
- GDPR - ar vartotojas gali ištrinti savo duomenis

### 4. Teisinė pusė
- Privacy Policy - ar egzistuoja, ar išsami, ar aprašo duomenų rinkimą
- Terms of Service - ar egzistuoja, ar aprašo naudojimo sąlygas
- Cookie policy - ar naudojami cookies, ar informuojamas vartotojas
- Disclaimer finansų funkcijoje - ar aiškiai parašyta kad tai ne oficiali buhalterija
- Ar planų kainos ir sąlygos aiškiai aprašytos
- Refund policy - ar aprašyta kas nutinka atšaukus planą
- Kontaktų puslapis - ar yra reali kontaktinė informacija

### 5. Verslo logikos auditas
- Ar Basic/Pro/Enterprise limitai veikia teisingai
- Ar spindulys užrakintas pagal planą (Basic 5km, Pro 15km, Enterprise 50km)
- Ar neautorizuotas vartotojas negali pasiekti Pro/Enterprise funkcijų
- Ar 14 dienų trial teisingai veikia