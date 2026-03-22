import type { Metadata } from 'next'
import LegalLayout from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Privatumo politika',
  description: 'Kaip Mini Social renka, naudoja ir saugo asmens duomenis.',
}

const sections = [
  {
    id: 'ivadas',
    title: '1. Įvadas',
    content: (
      <>
        <p>
          &bdquo;Mini Social&rdquo; yra socialinio tinklo platforma, kurios būstinė yra Lietuvoje. Mes esame įsipareigoję
          saugoti jūsų privatumą ir tvarkyti jūsų asmens duomenis skaidriai, laikydamiesi Bendrojo duomenų
          apsaugos reglamento (BDAR) ir Lietuvos Respublikos teisės aktų. Ši privatumo politika paaiškina, kokius
          duomenis renkame, kai naudojatės mūsų paslaugomis, įskaitant vartotojų profilius, sklaidos kanalą,
          tiesiogines žinutes, paslaugų katalogą bei dirbtinio intelekto asistentą.
        </p>
      </>
    ),
  },
  {
    id: 'renkami-duomenys',
    title: '2. Renkami asmens duomenys',
    content: (
      <>
        <p>Mes renkame šią informaciją:</p>
        <ul>
          <li>Registracijos duomenys: el. pašto adresas, slaptažodis (tvarkoma per &bdquo;Supabase Auth&rdquo;), vartotojo vardas.</li>
          <li>Profilio informacija: vardas, pavardė, nuotrauka, biografija, verslo informacija (Pro/Enterprise vartotojams).</li>
          <li>Vartotojų turinys: įrašai, komentarai, reakcijos, tiesioginės žinutės ir paslaugų skelbimai.</li>
          <li>Techniniai duomenys: IP adresas, naršyklės tipas, įrenginio informacija, prisijungimo laikai.</li>
          <li>Vietos duomenys: geografinė padėtis (jei suteikiate leidimą) turinio filtravimui pagal vietovę.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'tvarkymo-tikslai',
    title: '3. Duomenų tvarkymo tikslai ir AI naudojimas',
    content: (
      <>
        <p>
          Jūsų duomenis naudojame platformos veikimui užtikrinti, bendravimui tarp vartotojų palengvinti ir
          paslaugų personalizavimui. &bdquo;Mini Social&rdquo; naudoja &bdquo;Google Gemini&rdquo; dirbtinio intelekto technologiją.
          Kai sąveikaujate su AI asistentu, jūsų užklausos gali būti apdorojamos siekiant pateikti atsakymus.
          Rekomenduojame užklausose nepateikti jautrios asmeninės informacijos.
        </p>
      </>
    ),
  },
  {
    id: 'teisinis-pagrindas',
    title: '4. Teisinis duomenų tvarkymo pagrindas',
    content: (
      <>
        <p>Asmens duomenis tvarkome remdamiesi šiais pagrindais:</p>
        <ul>
          <li>Sutarties vykdymas: kad galėtume suteikti socialinio tinklo paslaugas.</li>
          <li>Teisėtas interesas: platformos saugumui, sukčiavimui prevencijai ir paslaugų kokybės gerinimui.</li>
          <li>Sutikimas: tiesioginei rinkodarai arba tikslių vietos duomenų naudojimui.</li>
          <li>Teisinė prievolė: mokesčių ir apskaitos tikslais.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'vietos-duomenys',
    title: '5. Vietos duomenys ir Google Maps integracija',
    content: (
      <>
        <p>
          Siekiant pateikti aktualų vietos turinį, naudojame PostGIS technologiją ir Google Maps integraciją.
          Jūsų vietos informacija naudojama tik tada, kai tai būtina paslaugos teikimui (pvz., ieškant paslaugų
          šalia jūsų). Jūs bet kada galite išjungti vietos bendrinimą savo įrenginio nustatymuose.
        </p>
      </>
    ),
  },
  {
    id: 'mokejimai',
    title: '6. Mokėjimai ir Stripe paslaugos',
    content: (
      <>
        <p>
          Pro ir Enterprise verslo prenumeratų apdorojimui naudojame trečiosios šalies mokėjimų teikėją Stripe.
          &bdquo;Mini Social&rdquo; savo serveriuose nesaugo jūsų pilnų banko kortelių duomenų – ši informacija
          saugiai perduodama tiesiogiai Stripe platformai, kuri atitinka PCI DSS saugumo standartus.
        </p>
      </>
    ),
  },
  {
    id: 'trecioji-salis',
    title: '7. Duomenų perdavimas trečiosioms šalims',
    content: (
      <>
        <p>Jūsų duomenys gali būti perduodami šiems paslaugų teikėjams:</p>
        <ul>
          <li>Supabase: infrastruktūros, duomenų bazių ir autentifikavimo paslaugoms.</li>
          <li>Stripe: mokėjimų apdorojimui.</li>
          <li>Google Cloud / Gemini: žemėlapių paslaugoms ir AI funkcionalumui užtikrinti.</li>
        </ul>
        <p>
          Visi partneriai laikosi BDAR reikalavimų. Duomenims, perduodamiems už EEE ribų, taikomos standartinės
          sutarčių sąlygos.
        </p>
      </>
    ),
  },
  {
    id: 'saugojimo-terminai',
    title: '8. Duomenų saugojimo terminai',
    content: (
      <>
        <p>
          Asmens duomenis saugome tiek laiko, kiek aktyvi jūsų vartotojo paskyra. Ištrynus paskyrą, jūsų duomenys
          pašalinami arba nuasmeninami per 30 dienų, išskyrus atvejus, kai teisiniai aktai reikalauja ilgesnio
          saugojimo (pvz., sąskaitos faktūros – 10 metų pagal Lietuvos teisę).
        </p>
      </>
    ),
  },
  {
    id: 'jusu-teises',
    title: '9. Jūsų teisės pagal BDAR',
    content: (
      <>
        <p>Jūs turite šias teises:</p>
        <ul>
          <li>Teisę susipažinti su savo duomenimis ir gauti jų kopiją.</li>
          <li>Teisę reikalauti ištaisyti neteisingus duomenis.</li>
          <li>Teisę reikalauti ištrinti duomenis (teisė būti pamirštam).</li>
          <li>Teisę apriboti duomenų tvarkymą arba nesutikti su juo.</li>
          <li>Teisę į duomenų perkeliamumą.</li>
          <li>Teisę bet kada atšaukti duotą sutikimą.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'kontaktai',
    title: '10. Kontaktinė informacija',
    content: (
      <>
        <p>
          Jei turite klausimų dėl duomenų tvarkymo, susisiekite su mumis el. paštu:{' '}
          <strong>support@minisocial.lt</strong>. Taip pat turite teisę pateikti skundą Valstybinei duomenų
          apsaugos inspekcijai (VDAI).
        </p>
      </>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privatumo politika"
      lastUpdated="2026-03-22"
      sections={sections}
    />
  )
}
