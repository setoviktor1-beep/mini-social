'use client'

import Link from 'next/link'
import {
  MessageCircle,
  Users,
  Sparkles,
  Store,
  Bell,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mini-social.online'

export default function LandingPage() {
  const { t, lang } = useI18n()

  const features = [
    {
      icon: MessageCircle,
      title: t('landing.feature1Title', 'Srautas ir diskusijos'),
      text: t('landing.feature1Desc', 'Dalinkis įrašais, komentuok, cituok ir dalyvauk teminėse diskusijose.'),
    },
    {
      icon: Users,
      title: t('landing.feature2Title', 'Privačios žinutės realiu laiku'),
      text: t('landing.feature2Desc', 'Susirašinėk akimirksniu — žinutės pristatomos realiu laiku be perkrovimo.'),
    },
    {
      icon: Store,
      title: t('landing.feature3Title', 'Paslaugų erdvė'),
      text: t('landing.feature3Desc', 'Rask specialistus savo mieste arba siūlyk savo paslaugas bendruomenei.'),
    },
    {
      icon: Sparkles,
      title: t('landing.feature4Title', 'AI pagalbininkas'),
      text: t('landing.feature4Desc', 'Dirbtinis intelektas padeda tobulinti įrašus, atsakyti ir kurti turinį.'),
    },
    {
      icon: Bell,
      title: t('landing.feature5Title', 'Pranešimai'),
      text: t('landing.feature5Desc', 'Gauk pranešimus apie patiktukus, komentarus, sekėjus ir žinutes.'),
    },
    {
      icon: ShieldCheck,
      title: t('landing.feature6Title', 'Privatumas ir saugumas'),
      text: t('landing.feature6Desc', 'Tik būtinieji slapukai, jokių sekimo skriptų, GDPR atitiktis ir paskyros trynimas vienu mygtuku.'),
    },
  ]

  const faq = [
    {
      q: t('landing.faq1Q', 'Ar „Mini Social“ nemokamas?'),
      a: t('landing.faq1A', 'Taip — registracija ir pagrindinės funkcijos (srautas, žinutės, diskusijos, pranešimai) yra nemokamos. Papildomos verslo ir AI funkcijos apmokestinamos pagal naudojimą.'),
    },
    {
      q: t('landing.faq2Q', 'Kas yra „Mini Social“?'),
      a: t('landing.faq2A', 'Mini Social — socialinis tinklas tikram bendravimui: įrašai, diskusijos, privačios žinutės realiu laiku ir paslaugų erdvė specialistams bei klientams.'),
    },
    {
      q: t('landing.faq3Q', 'Ar mano duomenys saugūs?'),
      a: t('landing.faq3A', 'Naudojame tik būtinuosius slapukus, be reklamos sekimo. Paskyrą ir visus duomenis gali ištrinti pats bet kuriuo metu nustatymuose.'),
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'Mini Social',
        description: t('landing.heroSubtitle', 'Socialinis tinklas tikram bendravimui.'),
        inLanguage: lang,
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'Mini Social',
        url: siteUrl,
        email: 'support@minisocial.lt',
      },
      {
        '@type': 'WebApplication',
        name: 'Mini Social',
        url: siteUrl,
        applicationCategory: 'SocialNetworkingApplication',
        operatingSystem: 'Web, Android',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO */}
      <section className="py-14 text-center sm:py-20">
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight text-slate-900 sm:text-5xl dark:text-white">
          {t('landing.heroTitle1', 'Bendrauk paprastai.')}
          <span className="block text-blue-600">
            {t('landing.heroTitle2', 'Be triukšmo, be sekimo.')}
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          {t('landing.heroSubtitle', 'Mini Social — socialinis tinklas: įrašai, diskusijos, žinutės realiu laiku ir paslaugų erdvė vienoje vietoje.')}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-600/40"
          >
            {t('landing.createAccountFree', 'Sukurti paskyrą nemokamai')}
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-full border border-slate-300 px-8 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('landing.login', 'Prisijungti')}
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          {t('landing.badge', 'Nemokama registracija · Tik būtinieji slapukai · GDPR atitiktis')}
        </p>
      </section>

      {/* FEATURES */}
      <section aria-labelledby="features-heading" className="py-10">
        <h2 id="features-heading" className="mb-8 text-center text-2xl font-black text-slate-900 sm:text-3xl dark:text-white">
          {t('landing.featuresHeading', 'Viskas, ko reikia bendravimui')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <feature.icon className="mb-3 text-blue-600" size={26} strokeWidth={2} />
              <h3 className="mb-1.5 font-bold text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="py-10">
        <h2 id="faq-heading" className="mb-8 text-center text-2xl font-black text-slate-900 sm:text-3xl dark:text-white">
          {t('landing.faqHeading', 'Dažniausi klausimai')}
        </h2>
        <div className="mx-auto max-w-2xl space-y-4">
          {faq.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
            >
              <summary className="cursor-pointer list-none font-bold text-slate-900 dark:text-white">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-14 text-center">
        <div className="rounded-3xl bg-blue-600 px-6 py-12 text-white">
          <h2 className="text-2xl font-black sm:text-3xl">
            {t('landing.ctaHeading', 'Prisijunk prie bendruomenės')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            {t('landing.ctaSubtitle', 'Registracija užtrunka mažiau nei minutę.')}
          </p>
          <Link
            href="/auth/register"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('landing.registerNow', 'Registruotis dabar')}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  )
}
