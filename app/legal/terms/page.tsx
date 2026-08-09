import type { Metadata } from 'next'
import LegalLayout from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Naudojimo sąlygos',
  description: 'Mini Social platformos naudojimo taisyklės ir sąlygos.',
}

const sections = [
  {
    id: 'bendrosios',
    title: '1. Bendrosios nuostatos',
    content: (
      <>
        <p>
          Šios naudojimo sąlygos reglamentuoja jūsų naudojimąsi &bdquo;Mini Social&rdquo; platforma, kurią valdo Lietuvoje
          registruota įmonė. Naudodamiesi programėle, jūs sutinkate su šiomis taisyklėmis. Jei nesutinkate,
          paslauga naudotis negalite.
        </p>
      </>
    ),
  },
  {
    id: 'registracija',
    title: '2. Registracija ir paskyra',
    content: (
      <>
        <p>
          Naudotojai privalo pateikti teisingą informaciją registracijos metu. Paskyra yra asmeninė, o naudotojas
          atsako už savo prisijungimo duomenų saugumą. Paslaugomis gali naudotis asmenys nuo 14 metų.
        </p>
      </>
    ),
  },
  {
    id: 'turinys',
    title: '3. Naudotojų turinys ir elgesys',
    content: (
      <>
        <p>Jūs esate atsakingi už visą turinį (įrašus, nuotraukas, žinutes), kurį skelbiate. Draudžiama:</p>
        <ul>
          <li>Platinti neteisėtą, įžeidžiantį ar klaidinantį turinį.</li>
          <li>Naudoti platformą sukčiavimui ar nepageidaujamų reklamų (spam) siuntimui.</li>
          <li>Pažeidinėti kitų vartotojų privatumą ar intelektinę nuosavybę.</li>
          <li>Bandyti gauti neteisėtą prieigą prie sistemos ar kitų vartotojų paskyrų.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'prenumeratos',
    title: '4. Pro ir Enterprise prenumeratos',
    content: (
      <>
        <p>
          Verslo paslaugos (Basic &ndash; €14,99/mėn., Pro &ndash; €29,99/mėn., Enterprise &ndash; €89,99/mėn.)
          teikiamos pagal mokamos prenumeratos modelį. Atsiskaitymai vykdomi per saugią Stripe sistemą.
          Prenumerata automatiškai pratęsiama, nebent ji atšaukiama nustatymuose prieš naują atsiskaitymo
          laikotarpį. Pro ir Enterprise planams taikomas 14 dienų nemokamas bandomasis laikotarpis; Basic
          planui bandomasis laikotarpis netaikomas.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    title: '5. Dirbtinis intelektas (AI asistentas)',
    content: (
      <>
        <p>
          Platformoje integruotas AI asistentas (Google Gemini). Ši technologija teikia automatizuotus atsakymus,
          kurie gali būti netikslūs. &bdquo;Mini Social&rdquo; neatsako už AI sugeneruoto turinio pasekmes ar jo
          teisingumą. AI funkcijos prieinamos tik Pro ir Enterprise prenumeratos vartotojams.
        </p>
      </>
    ),
  },
  {
    id: 'vieta',
    title: '6. Vietovės paslaugos ir žemėlapiai',
    content: (
      <>
        <p>
          Programėlė naudoja vietovės filtravimą (PostGIS) ir Google Maps paslaugas. Naudodamiesi šia funkcija,
          jūs sutinkate su Google Maps papildomomis paslaugų teikimo sąlygomis. Vietovės duomenys renkami tik
          gavus jūsų sutikimą ir naudojami turinio filtravimui pagal jūsų nustatytą spindulį.
        </p>
      </>
    ),
  },
  {
    id: 'intelektine',
    title: '7. Intelektinė nuosavybė',
    content: (
      <>
        <p>
          Visas platformos kodas, dizainas ir prekių ženklai priklauso &bdquo;Mini Social&rdquo;. Jūs išsaugote teises į
          savo paskelbtą turinį, tačiau suteikiate mums ne išimtinę licenciją jį rodyti ir platinti platformos
          viduje, siekiant teikti paslaugą.
        </p>
      </>
    ),
  },
  {
    id: 'atsakomybe',
    title: '8. Atsakomybės ribojimas',
    content: (
      <>
        <p>
          Paslaugos teikiamos be jokių garantijų. Mes neatsakome už laikinus sutrikimus, naudotojų tarpusavio
          ginčus ar finansinius nuostolius, patirtus naudojantis platformos paslaugomis. Maksimali mūsų
          atsakomybė neviršija per paskutinius 3 mėnesius sumokėtų prenumeratos mokesčių sumos.
        </p>
      </>
    ),
  },
  {
    id: 'bdar',
    title: '9. Asmens duomenų apsauga (BDAR)',
    content: (
      <>
        <p>
          Jūsų duomenys tvarkomi laikantis BDAR ir Lietuvos įstatymų. Išsami informacija pateikiama{' '}
          <a href="/legal/privacy" className="text-blue-500 hover:underline">
            Privatumo politikoje
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'baigiamosios',
    title: '10. Baigiamosios nuostatos',
    content: (
      <>
        <p>
          Šioms sąlygoms taikoma Lietuvos Respublikos teisė. Visi ginčai sprendžiami derybų keliu, o nepavykus
          &ndash; kompetentingame Lietuvos teisme. Mes pasiliekame teisę bet kada atnaujinti šias sąlygas
          informuojant naudotojus platformoje.
        </p>
      </>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalLayout
      title="Naudojimo sąlygos"
      lastUpdated="2026-03-22"
      sections={sections}
    />
  )
}
