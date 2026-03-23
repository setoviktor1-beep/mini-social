# Lokalizacijos (i18n) Audito Ataskaita 🌍

**Data:** 2026-03-23
**Autorius:** Vertejas (Lokalizacijos Inžinierius)
**Būsena:** KRITINĖS KLAIDOS

## 1. Sistemos Architektūros Apžvalga (`lib/i18n.tsx`)

Dabartinė lokalizacijos sistema yra realizuota per React Context, tačiau ji turi rimtų trūkumų:
- **Mastelio problema:** Visos vertimų eilutės (LT, EN, RU, PL, UK) laikomos viename `.tsx` faile. Programėlei augant, šis failas taps nevaldomas.
- **Ribota aprėptis:** `lib/i18n.tsx` dengia tik bazinius elementus (`nav`, `settings`, `common`, `feed`, `services`, `auth`).
- **Nėra parametrų:** Sistema nepalaiko dinaminių parametrų vertimuose (pvz., "Prieš 5 minutes").

## 2. Kritiniai Radiniai (Kietai įkoduoti tekstai)

### 2.1. Kalbinis „Mixas“ (Inconsistency)
Daugelyje failų tekstai pateikiami chaotiškai – dalis angliškai, dalis lietuviškai:
- **`app/page.tsx`:** 
  - `label: 'Home'` (EN) vs `label: 'Paslaugos'` (LT).
  - `label: 'Verslo Darbalaukis'` (LT) vs `label: 'Explore'` (EN).
  - `Sign in to join the conversation.` (EN).
- **`components/BottomNav.tsx`:**
  - `label: 'Home'` (EN) vs `label: 'Paieška'` (LT) vs `label: 'Profilis'` (LT).

### 2.2. Visiškai nelokalizuoti moduliai
Šie moduliai neturi jokių įrašų `i18n.tsx` faile, nors juose gausu naudotojo sąsajos tekstų:
- **Pro modulis (`components/pro/*`):** Visi tekstai kietai įkoduoti lietuviškai (pvz., "Užsakymai", "Kainoraštis", "AI Asistentas — Pro funkcija").
- **Admin panelė (`components/admin/*`):** Visi tekstai kietai įkoduoti angliškai (pvz., "Dashboard", "Audit Log", "Back to site").
- **Autentifikacija (`app/auth/login/page.tsx`):** Nors `auth` kategorija egzistuoja, realūs puslapiai jos nenaudoja. Visi pranešimai (pvz., "Please confirm your email first") yra angliški.
- **Diskusijos (`app/discussions/*`):** Visiškai nėra vertimų.
- **Pranešimai (`app/notifications/*`):** Visiškai nėra vertimų.

### 2.3. Ignoruojami egzistuojantys raktai
Kai kurie komponentai turi kietai įkoduotus tekstus, nors vertimų faile jie jau yra:
- **`components/PostComposer.tsx`:** Naudoja "What's on your mind?", "Post", "Posting...", nors `feed.placeholder`, `feed.post` ir `feed.posting` jau egzistuoja.

## 3. Techninės detalės ir sintaksė

- **Kabutės:** Vertimuose naudojamos vienos kabutės `'`. Ukrainiečių kalbos vertime (`uk`) aptiktos pabėgusios kabutės: `Відображуване ім\'я`. Tai techniškai teisinga, bet rekomenduojama naudoti JSON failus, kad būtų išvengta JS sintaksės konfliktų.
- **Trūkstami raktai:** Jei raktas nerandamas, sistema grąžina patį raktą. Tai gerai, bet UI atrodo neprofesionaliai, kai rodoma `nav.feed` vietoj teksto.

## 4. Rekomendacijos (Action Plan)

1.  **Atskirti vertimus:** Perkelti vertimus į atskirus JSON failus (`public/locales/{lang}.json`).
2.  **Lokalizuoti Pro modulį:** Skubiai perkelti visus lietuviškus tekstus iš `components/pro/` į lokalizacijos failus.
3.  **Suvienodinti kalbą:** Nuspręsti, kokia yra bazinė kūrimo kalba (rekomenduojama EN) ir visus kietai įkoduotus tekstus pirmiausia paversti raktais.
4.  **Audit Log vertimas:** Įtraukti Admin panelės elementus į i18n sistemą.
5.  **Automatinė patikra:** Įdiegti ESLint taisyklę `react/jsx-no-literals` (arba panašią), kad nauji kietai įkoduoti tekstai nepatektų į produkciją.

## 5. Prioritetiniai failai taisymui

1.  `app/page.tsx` (Pagrindinis vaizdas)
2.  `app/auth/login/page.tsx` (Pirmas įspūdis naujam vartotojui)
3.  `components/pro/ProDashboardTabs.tsx` (Verslo dalis)
4.  `components/BottomNav.tsx` (Navigacija)

---
*Ataskaitą parengė: Vertejas*
