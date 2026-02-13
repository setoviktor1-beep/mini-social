import Link from 'next/link'

type LegalSection = {
  id: string
  title: string
  content: React.ReactNode
}

export default function LegalLayout({
  title,
  lastUpdated,
  sections,
}: {
  title: string
  lastUpdated: string
  sections: LegalSection[]
}) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-8">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Last updated: {lastUpdated}</p>
      </header>

      <nav
        aria-label="Table of contents"
        className="mb-8 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Contents</h2>
        <ul className="mt-3 space-y-2">
          {sections.map((section) => (
            <li key={section.id}>
              <Link
                href={`#${section.id}`}
                className="text-sm text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)] rounded-sm"
              >
                {section.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="prose prose-invert max-w-none">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="mb-8 scroll-mt-24">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{section.title}</h2>
            <div className="mt-3 text-[var(--text-secondary)] space-y-3">{section.content}</div>
          </section>
        ))}
      </div>
    </article>
  )
}
