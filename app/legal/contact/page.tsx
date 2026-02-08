export default function ContactPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">Contact</h1>
        <p className="text-gray-600">
          For help with accounts, reports, or privacy requests, use the contact details below.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Email</h2>
        <p className="mt-2 text-gray-700">
          <a className="font-bold text-blue-600 hover:text-blue-700" href="mailto:support@example.com">
            support@example.com
          </a>
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Replace this placeholder email with your real support address.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Response time</h2>
        <p className="mt-2 text-gray-700">
          Typically within 1-2 business days.
        </p>
      </section>
    </div>
  )
}

