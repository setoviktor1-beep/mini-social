import type { Metadata } from 'next'
import LegalLayout from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Slapukų politika',
  description: 'Kaip Mini Social naudoja slapukus ir panašias technologijas.',
}

const sections = [
  {
    id: 'kas-yra-slapukai',
    title: '1. Kas yra slapukai',
    content: (
      <p>
        Slapukai yra maži tekstiniai failai, saugomi jūsų įrenginyje. Jie padeda platformai prisiminti sesiją,
        saugumo nustatymus ir pasirinkimus.
      </p>
    ),
  },
  {
    id: 'naudojami-slapukai',
    title: '2. Kokius slapukus naudojame',
    content: (
      <>
        <p>Mini Social naudoja šias slapukų ir panašių technologijų kategorijas:</p>
        <ul>
          <li>Būtinieji slapukai: prisijungimui, sesijos saugumui ir paskyros veikimui.</li>
          <li>Funkciniai slapukai: temos, kalbos ir kitų vartotojo pasirinkimų išsaugojimui.</li>
          <li>Mokėjimų ir saugumo technologijos: Stripe mokėjimų eigai ir sukčiavimo prevencijai.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'treciosios-salys',
    title: '3. Trečiosios šalys',
    content: (
      <p>
        Kai naudojatės mokėjimais, žemėlapiais ar AI funkcijomis, atitinkami paslaugų teikėjai, tokie kaip
        Stripe, Google ir Supabase, gali naudoti savo slapukus ar panašias technologijas pagal jų privatumo
        taisykles.
      </p>
    ),
  },
  {
    id: 'valdymas',
    title: '4. Kaip valdyti slapukus',
    content: (
      <p>
        Slapukus galite valdyti naršyklės nustatymuose. Išjungus būtinuosius slapukus, prisijungimas, mokėjimai
        ar kitos pagrindinės platformos funkcijos gali neveikti.
      </p>
    ),
  },
  {
    id: 'kontaktai',
    title: '5. Kontaktai',
    content: (
      <p>
        Klausimus dėl slapukų ar privatumo siųskite el. paštu <strong>support@minisocial.lt</strong>.
      </p>
    ),
  },
]

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Slapukų politika"
      lastUpdated="2026-06-20"
      sections={sections}
    />
  )
}
