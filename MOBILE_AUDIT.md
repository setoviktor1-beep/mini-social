# Mobile UI/UX Audit — MiniSocial

_Atlikta: 2026-03-22_

## Pataisymai (šioje sesijoje)

### 1. Aptarnavimo spindulys — plano ribos (`ProSettings.tsx`)
- **Problema:** Slider leido pasirinkti bet kokią reikšmę iki 50km nepriklausomai nuo plano
- **Sprendimas:**
  - `max` atributas dabar = `maxRadius` prop (Basic=5, Pro=15, Enterprise=50)
  - Tooltip "Atnaujink planą kad padidintum spindulį" kai bandoma viršyti
  - Plano ženkliukas su spynele šalia pavadinimo
  - Jei vartotojas degradavo planą — radius nupjaunamas `Math.min(stored, maxRadius)`

### 2. Darbo laikas — mobilus layout (`ProSettings.tsx`)
- **Problema:** `[toggle][28 chars][time][dash][time]` eilutė per plati 320px ekranui
- **Sprendimas:**
  - 1 eilutė: toggle + dienos pavadinimas + "Nedirbama" tekstas
  - 2 eilutė (kai aktyvus): `grid-cols-2` su "Nuo" ir "Iki" dropdownais
  - Pakeisti `input[type=time]` → `<select>` su 30min žingsniais (geriau ant mobiliaus)

### 3. Navigacija — duplikatų šalinimas (`Navbar.tsx`)
- **Problema:** Mobile hamburger menu rodė "Verslo planai" IR "Verslo Darbalaukis" pro vartotojams
- **Sprendimas:** Sąlyga — pro/admin/master mato "Verslo Darbalaukis", kiti mato "Verslo planai"

### 4. Mobile header supaprastinimas (`Navbar.tsx`)
- **Problema:** Mobile top bar turėjo Search, ThemeToggle, Messages, Notifications, PushToggle, Menu — per daug piktogramų
- **Sprendimas:**
  - Palikta: ThemeToggle + NotificationBell + Menu
  - PushToggle + LanguageSwitcher perkelti į hamburger menu
  - Messages/Search → apatinė navigacija

### 5. Apatinė navigacija — naujas komponentas (`BottomNav.tsx`)
- **Funkcionalumas:**
  - Rodoma tik mobiliuose (md:hidden)
  - 5 elementai: Home, Paslaugos, Search, Inbox (su unread badge), Profilis
  - Touch target: `h-16` / `min-h-[44px]`
  - Aktyvus puslapis: mėlynas iconas + linija viršuje
  - Slepiama ant admin/auth puslapių
- **Layout.tsx:** `pb-20 md:pb-8` kad turinys nesislėptų po nav

### 6. ProDashboardTabs — 9 tab navigacija
- Tab padding: `px-3 sm:px-6 py-3 sm:py-4` (buvo `px-6 py-4` per plati 320px)
- Min-height: `min-h-[400px] md:min-h-[500px]`

---

## Neišspręstos problemos (stebėjimui)

| Puslapis | Problema | Kritinis? |
|---|---|---|
| `/admin/*` | Admin panel dizainas nėra responsive — desktop only | Ne (admin naudoja desktop) |
| `PostComposer` | Image preview gali išsiplėsti ≥ ekrano plotį | Vidutinis |
| `/messages` | Chat burbulai gali overflow su labai ilgais žodžiais | Žemas |

---

## Testavimo matricos

| Plotis | Status |
|---|---|
| 320px (SE) | ✅ Darbo laikas, radius, navigacija |
| 360px (Android) | ✅ |
| 375px (iPhone) | ✅ |
| 390px (iPhone 14) | ✅ |
| 430px (iPhone 14 Plus) | ✅ |
